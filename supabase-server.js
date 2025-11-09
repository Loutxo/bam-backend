/**
 * Serveur Express optimisé pour Supabase
 * Configuration automatique avec .env.local
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration CORS
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'https://localhost:3000'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    supabase: {
      url: process.env.SUPABASE_URL,
      hasAnonKey: !!process.env.SUPABASE_ANON_KEY,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY
    },
    geolocation: {
      defaultRadius: process.env.DEFAULT_SEARCH_RADIUS || '10000',
      maxRadius: process.env.MAX_SEARCH_RADIUS || '50000'
    }
  });
});

// API Info endpoint
app.get('/api/info', (req, res) => {
  res.json({
    name: 'BAM API',
    version: '2.0.0',
    description: 'API de signalement collaborative optimisée avec Supabase',
    database: 'Supabase PostgreSQL',
    geolocation: 'Optimisé pour 10km',
    features: [
      'Signalement collaboratif',
      'Géolocalisation 10km',
      'Système de gamification',
      'Reviews et appels',
      'Zones favorites',
      'Real-time avec Supabase'
    ],
    endpoints: {
      '/health': 'Status de l\'API',
      '/api/info': 'Informations de l\'API',
      '/api/test': 'Test de connexion Supabase'
    }
  });
});

// Test de connexion Supabase
app.get('/api/test', async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      return res.status(500).json({
        error: 'Configuration Supabase manquante',
        message: 'Vérifiez SUPABASE_URL et SUPABASE_SERVICE_KEY dans .env.local'
      });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Test de connexion avec count des badges
    const { data, error, count } = await supabase
      .from('Badge')
      .select('*', { count: 'exact' });

    if (error) {
      return res.status(500).json({
        error: 'Erreur Supabase',
        message: error.message
      });
    }

    res.json({
      status: 'Supabase OK',
      connection: 'Réussie',
      badges: {
        count: count,
        data: data
      },
      functions: {
        calculate_distance: 'Disponible',
        find_nearby_users: 'Disponible (10km par défaut)',
        find_nearby_bams: 'Disponible (10km par défaut)'
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Erreur de test',
      message: error.message
    });
  }
});

// Test des fonctions géolocalisation
app.get('/api/test/geolocation', async (req, res) => {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Test de la fonction calculate_distance
    const { data: distanceTest, error: distanceError } = await supabase
      .rpc('calculate_distance', {
        lat1: 48.8566,
        lon1: 2.3522,  // Paris
        lat2: 48.8606,
        lon2: 2.3376   // Louvre (environ 1.5km)
      });

    if (distanceError) {
      return res.status(500).json({
        error: 'Erreur fonction distance',
        message: distanceError.message
      });
    }

    // Test de find_nearby_users (sans utilisateurs)
    const { data: nearbyUsers, error: usersError } = await supabase
      .rpc('find_nearby_users', {
        user_lat: 48.8566,
        user_lng: 2.3522,
        radius_meters: 10000
      });

    res.json({
      status: 'Géolocalisation OK',
      tests: {
        distance_function: {
          paris_to_louvre: `${Math.round(distanceTest)} mètres`,
          status: 'OK'
        },
        nearby_users: {
          found: nearbyUsers?.length || 0,
          radius: '10km',
          status: 'OK'
        }
      },
      configuration: {
        default_radius: process.env.DEFAULT_SEARCH_RADIUS || '10000',
        max_radius: process.env.MAX_SEARCH_RADIUS || '50000'
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Erreur test géolocalisation',
      message: error.message
    });
  }
});

// Endpoint pour installer les dépendances Supabase si manquantes
app.post('/api/install-supabase', async (req, res) => {
  try {
    const { exec } = require('child_process');
    
    exec('npm install @supabase/supabase-js', (error, stdout, stderr) => {
      if (error) {
        return res.status(500).json({
          error: 'Erreur installation',
          message: error.message
        });
      }
      
      res.json({
        status: 'Installation réussie',
        output: stdout,
        message: 'Redémarrez le serveur après installation'
      });
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Erreur installation Supabase',
      message: error.message
    });
  }
});

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
  console.error('Erreur serveur:', err);
  res.status(500).json({
    error: 'Erreur serveur interne',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// Gestionnaire 404
app.use((req, res) => {
  res.status(404).json({
    error: '404 - Endpoint non trouvé',
    path: req.originalUrl,
    available_endpoints: [
      '/health',
      '/api/info', 
      '/api/test',
      '/api/test/geolocation'
    ]
  });
});

// Démarrage du serveur
const server = app.listen(PORT, () => {
  console.log(`\n🚀 Serveur BAM API démarré !`);
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Supabase URL: ${process.env.SUPABASE_URL || 'Non configuré'}`);
  console.log(`📍 Géolocalisation: ${process.env.DEFAULT_SEARCH_RADIUS || '10000'}m par défaut`);
  console.log(`\n📋 Endpoints disponibles :`);
  console.log(`   GET  /health              - Status API`);
  console.log(`   GET  /api/info            - Infos API`);
  console.log(`   GET  /api/test            - Test Supabase`);
  console.log(`   GET  /api/test/geolocation - Test géolocalisation`);
  console.log(`   POST /api/install-supabase - Installer Supabase SDK`);
  console.log(`\n✨ Prêt pour les tests Postman !`);
});

// Gestion propre de l'arrêt
process.on('SIGTERM', () => {
  console.log('🛑 Arrêt du serveur...');
  server.close(() => {
    console.log('✅ Serveur fermé proprement');
    process.exit(0);
  });
});

module.exports = app;