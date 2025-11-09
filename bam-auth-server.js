const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// Charger .env.local en priorité
require('dotenv').config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration Rate Limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Trop de requêtes, veuillez réessayer plus tard',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting spécifique pour l'auth (plus strict)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 tentatives
  message: {
    error: 'Trop de tentatives de connexion, veuillez réessayer plus tard',
    retryAfter: '15 minutes'
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api/', limiter); // Appliquer le rate limiting sur toutes les routes /api/*

// Initialiser Supabase
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Middleware d'authentification
const authenticateUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Token manquant' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Token invalide' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Erreur d\'authentification' });
  }
};

// ===== ROUTES PUBLIQUES =====

// Route d'accueil
app.get('/', (req, res) => {
  res.json({
    message: '🚀 BAM API - Bouteille À la Mer',
    version: '2.0.0',
    status: 'Production Ready',
    endpoints: {
      public: {
        health: 'GET /health',
        auth_register: 'POST /auth/register',
        auth_login: 'POST /auth/login'
      },
      protected: {
        auth_me: 'GET /auth/me',
        badges: 'GET /api/badges',
        bams_create: 'POST /api/bams',
        bams_get: 'GET /api/bams/:id',
        bams_update: 'PUT /api/bams/:id',
        bams_delete: 'DELETE /api/bams/:id',
        bams_nearby: 'GET /api/bams/nearby',
        reviews_create: 'POST /api/reviews',
        calls_create: 'POST /api/calls'
      }
    },
    authentication: 'Bearer Token required for protected endpoints',
    rate_limiting: '100 requests per 15 minutes',
    documentation: 'https://github.com/Loutxo/bam-backend'
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    supabase: process.env.SUPABASE_URL ? 'Configuré' : 'Non configuré',
    auth: 'Activé'
  });
});

// ===== ROUTES D'AUTHENTIFICATION =====

// Inscription
app.post('/auth/register', authLimiter, async (req, res) => {
  try {
    const { email, password, username, firstName, lastName } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({
        error: 'Email, password et username requis'
      });
    }

    // Créer l'utilisateur avec Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          first_name: firstName,
          last_name: lastName
        }
      }
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    // Créer le profil utilisateur dans notre table User
    if (authData.user) {
      const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );

      const { error: profileError } = await supabaseAdmin
        .from('User')
        .insert({
          id: authData.user.id,
          username,
          email,
          firstName,
          lastName,
          createdAt: new Date().toISOString()
        });

      if (profileError) {
        console.error('Erreur création profil:', profileError);
      }
    }

    res.json({
      success: true,
      message: 'Inscription réussie',
      user: authData.user,
      session: authData.session
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Connexion
app.post('/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email et password requis'
      });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      success: true,
      message: 'Connexion réussie',
      user: data.user,
      session: data.session,
      access_token: data.session.access_token
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Profil utilisateur authentifié
app.get('/auth/me', authenticateUser, async (req, res) => {
  try {
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data: profile, error } = await supabaseAdmin
      .from('User')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Profil utilisateur non trouvé' });
    }

    res.json({
      success: true,
      user: {
        ...req.user,
        profile
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== ROUTES PROTÉGÉES =====

// API Badges (protégée)
app.get('/api/badges', authenticateUser, async (req, res) => {
  try {
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data, error } = await supabaseAdmin
      .from('Badge')
      .select('*')
      .order('name');

    if (error) throw error;

    res.json({
      success: true,
      data: data || [],
      count: data?.length || 0
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// BAMs à proximité (protégée)
app.get('/api/bams/nearby', authenticateUser, async (req, res) => {
  try {
    const { latitude, longitude, radius = 10000 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        error: 'Latitude et longitude requises'
      });
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Utiliser la fonction de calcul de distance que nous avons créée
    const { data, error } = await supabaseAdmin.rpc('find_nearby_bams', {
      user_lat: parseFloat(latitude),
      user_lng: parseFloat(longitude),
      radius_meters: parseInt(radius)
    });

    if (error) throw error;

    res.json({
      success: true,
      data: data || [],
      count: data?.length || 0,
      search_params: {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radius: parseInt(radius)
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Créer un BAM (protégé)
app.post('/api/bams', authenticateUser, async (req, res) => {
  try {
    const { title, description, category, subcategory, severity, latitude, longitude, address, isAnonymous } = req.body;

    if (!title || !description || !category || !latitude || !longitude) {
      return res.status(400).json({
        error: 'Titre, description, catégorie, latitude et longitude requis'
      });
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data, error } = await supabaseAdmin
      .from('Bam')
      .insert({
        userId: req.user.id,
        title,
        description,
        category,
        subcategory,
        severity: severity || 'medium',
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address,
        isAnonymous: isAnonymous || false,
        status: 'open',
        createdAt: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Incrémenter le compteur de BAMs de l'utilisateur
    await supabaseAdmin
      .from('User')
      .update({ 
        bamCount: supabaseAdmin.rpc('increment', { x: 1 }),
        lastActivity: new Date().toISOString()
      })
      .eq('id', req.user.id);

    res.status(201).json({
      success: true,
      data,
      message: 'BAM créé avec succès'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Récupérer un BAM spécifique
app.get('/api/bams/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data, error } = await supabaseAdmin
      .from('Bam')
      .select(`
        *,
        author:User!userId(id, username, profilePicture, currentLevel),
        reviews:Review(count)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    // Incrémenter le compteur de vues
    await supabaseAdmin
      .from('Bam')
      .update({ 
        viewCount: (data.viewCount || 0) + 1,
        lastViewedAt: new Date().toISOString()
      })
      .eq('id', id);

    res.json({
      success: true,
      data
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Modifier un BAM (protégé, seulement l'auteur)
app.put('/api/bams/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category, subcategory, severity, status } = req.body;

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Vérifier que l'utilisateur est l'auteur
    const { data: existingBam, error: checkError } = await supabaseAdmin
      .from('Bam')
      .select('userId')
      .eq('id', id)
      .single();

    if (checkError) throw checkError;

    if (existingBam.userId !== req.user.id) {
      return res.status(403).json({
        error: 'Vous ne pouvez modifier que vos propres BAMs'
      });
    }

    const updateData = {
      updatedAt: new Date().toISOString()
    };

    if (title) updateData.title = title;
    if (description) updateData.description = description;
    if (category) updateData.category = category;
    if (subcategory) updateData.subcategory = subcategory;
    if (severity) updateData.severity = severity;
    if (status) updateData.status = status;

    const { data, error } = await supabaseAdmin
      .from('Bam')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data,
      message: 'BAM modifié avec succès'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Supprimer un BAM (protégé, seulement l'auteur)
app.delete('/api/bams/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Vérifier que l'utilisateur est l'auteur
    const { data: existingBam, error: checkError } = await supabaseAdmin
      .from('Bam')
      .select('userId')
      .eq('id', id)
      .single();

    if (checkError) throw checkError;

    if (existingBam.userId !== req.user.id) {
      return res.status(403).json({
        error: 'Vous ne pouvez supprimer que vos propres BAMs'
      });
    }

    const { error } = await supabaseAdmin
      .from('Bam')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'BAM supprimé avec succès'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Créer un review (protégé)
app.post('/api/reviews', authenticateUser, async (req, res) => {
  try {
    const { bamId, comment, rating, isHelpful } = req.body;

    if (!bamId || !comment || !rating) {
      return res.status(400).json({
        error: 'bamId, comment et rating requis'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        error: 'Le rating doit être entre 1 et 5'
      });
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data, error } = await supabaseAdmin
      .from('Review')
      .insert({
        bamId,
        userId: req.user.id,
        comment,
        rating,
        isHelpful: isHelpful || false,
        createdAt: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Incrémenter les compteurs
    await supabaseAdmin
      .from('User')
      .update({ 
        reviewCount: supabaseAdmin.rpc('increment', { x: 1 })
      })
      .eq('id', req.user.id);

    await supabaseAdmin
      .from('Bam')
      .update({ 
        commentCount: supabaseAdmin.rpc('increment', { x: 1 })
      })
      .eq('id', bamId);

    res.status(201).json({
      success: true,
      data,
      message: 'Review créé avec succès'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Enregistrer un appel (protégé)
app.post('/api/calls', authenticateUser, async (req, res) => {
  try {
    const { bamId, phoneNumber, duration, status, notes } = req.body;

    if (!bamId) {
      return res.status(400).json({
        error: 'bamId requis'
      });
    }

    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data, error } = await supabaseAdmin
      .from('Call')
      .insert({
        bamId,
        userId: req.user.id,
        phoneNumber,
        duration: duration || 0,
        status: status || 'completed',
        notes,
        createdAt: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Incrémenter le compteur d'appels
    await supabaseAdmin
      .from('User')
      .update({ 
        callCount: supabaseAdmin.rpc('increment', { x: 1 })
      })
      .eq('id', req.user.id);

    res.status(201).json({
      success: true,
      data,
      message: 'Appel enregistré avec succès'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test Supabase (garde l'ancien pour debug)
app.get('/api/test/supabase', async (req, res) => {
  try {
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data, error, count } = await supabaseAdmin
      .from('Badge')
      .select('*', { count: 'exact' });

    if (error) throw error;

    res.json({
      status: 'Supabase OK',
      badges_count: count,
      badges: data,
      project: process.env.SUPABASE_URL.match(/([^.]+)\.supabase\.co/)?.[1] || 'unknown',
      auth_enabled: true
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      supabase_url: process.env.SUPABASE_URL || 'Non défini'
    });
  }
});

// Export pour Vercel (serverless)
module.exports = app;

// Démarrage du serveur uniquement en mode développement local
if (process.env.NODE_ENV !== 'production' && require.main === module) {
  app.listen(PORT, async () => {
    console.log(`🚀 Serveur BAM avec Auth démarré sur http://localhost:${PORT}`);
    console.log(`🔗 Supabase: ${process.env.SUPABASE_URL || 'Non configuré'}`);
    console.log(`🔐 Authentification: Activée`);
    
    // Test initial
    try {
      const supabaseAdmin = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );

      const { data, error } = await supabaseAdmin
        .from('Badge')
        .select('count', { count: 'exact', head: true });

      if (error) throw error;

      console.log('✅ Supabase connecté - Auth prêt');
      console.log(`\n🎯 Endpoints disponibles:`);
      console.log(`   • POST /auth/register - Inscription`);
      console.log(`   • POST /auth/login - Connexion`);
      console.log(`   • GET /auth/me - Profil (Bearer token requis)`);
      console.log(`   • GET /api/badges - Badges (Bearer token requis)`);
      console.log(`   • GET /api/bams/nearby - BAMs proches (Bearer token requis)`);
    } catch (error) {
      console.error('❌ Erreur Supabase:', error.message);
    }
  });
}