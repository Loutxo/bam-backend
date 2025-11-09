/**
 * Routes optimisées pour Supabase avec intégration real-time
 */

const express = require('express');
const supabaseService = require('../services/supabaseService');
const router = express.Router();

// Middleware de modération automatique
const moderationMiddleware = async (req, res, next) => {
  if (req.body.description || req.body.comment || req.body.title) {
    try {
      const contentToModerate = req.body.description || req.body.comment || req.body.title;
      const moderationResult = await supabaseService.moderateContent(contentToModerate);
      
      if (!moderationResult.approved) {
        return res.status(400).json({
          error: 'Contenu non conforme',
          message: 'Votre contenu ne respecte pas nos conditions d\'utilisation',
          suggestions: moderationResult.suggestions,
          categories: moderationResult.categories
        });
      }
      
      // Ajouter le score de confiance au body
      req.body._moderationScore = moderationResult.confidence;
    } catch (error) {
      console.warn('Modération échouée:', error.message);
      // Continue sans bloquer si la modération échoue
    }
  }
  next();
};

// GET /api/bams - Liste paginée avec filtres géographiques
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      category, 
      status = 'open',
      lat,
      lng,
      radius = 10000 // 10km par défaut
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    // Construction de la requête avec filtres
    let query = supabaseService.admin
      .from('Bam')
      .select(`
        *,
        user:User(id, username, totalPoints, currentLevel),
        reviews:Review(count),
        calls:Call(count),
        _count:Review(count)
      `)
      .eq('status', status)
      .range(offset, offset + parseInt(limit) - 1)
      .order('createdAt', { ascending: false });

    // Filtre par catégorie
    if (category) {
      query = query.eq('category', category);
    }

    // Filtre géographique
    if (lat && lng) {
      const nearbyBams = await supabaseService.admin.rpc('find_nearby_bams', {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        radius_meters: parseInt(radius)
      });
      
      if (nearbyBams.data && nearbyBams.data.length > 0) {
        const bamIds = nearbyBams.data.map(b => b.id);
        query = query.in('id', bamIds);
      } else {
        return res.json({ bams: [], total: 0, hasMore: false });
      }
    }

    const { data: bams, error } = await query;
    
    if (error) {
      console.error('Erreur récupération BAMs:', error);
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    // Calcul du total pour pagination
    const { count: total } = await supabaseService.admin
      .from('Bam')
      .select('*', { count: 'exact', head: true })
      .eq('status', status);

    res.json({
      bams: bams || [],
      total: total || 0,
      hasMore: offset + parseInt(limit) < (total || 0),
      page: parseInt(page),
      limit: parseInt(limit)
    });

  } catch (error) {
    console.error('Erreur GET /bams:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/bams - Création avec validation avancée
router.post('/', moderationMiddleware, async (req, res) => {
  try {
    const {
      userId,
      title,
      description,
      category,
      subcategory,
      severity,
      latitude,
      longitude,
      address,
      isAnonymous = false,
      attachments = []
    } = req.body;

    // Validation des coordonnées géographiques
    if (latitude && longitude) {
      if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        return res.status(400).json({
          error: 'Coordonnées géographiques invalides'
        });
      }
    }

    // Création du BAM
    const { data: bam, error: bamError } = await supabaseService.admin
      .from('Bam')
      .insert({
        userId,
        title,
        description,
        category,
        subcategory,
        severity: severity || 'medium',
        latitude: latitude || null,
        longitude: longitude || null,
        address,
        isAnonymous,
        status: 'open',
        moderationScore: req.body._moderationScore || 0.95,
        createdAt: new Date().toISOString()
      })
      .select(`
        *,
        user:User(id, username, totalPoints, currentLevel)
      `)
      .single();

    if (bamError) {
      console.error('Erreur création BAM:', bamError);
      return res.status(500).json({ error: 'Erreur création BAM' });
    }

    // Traitement des pièces jointes
    if (attachments.length > 0) {
      const attachmentPromises = attachments.map(async (attachment) => {
        return supabaseService.admin
          .from('BamAttachment')
          .insert({
            bamId: bam.id,
            type: attachment.type,
            url: attachment.url,
            filename: attachment.filename,
            size: attachment.size
          });
      });

      await Promise.all(attachmentPromises);
    }

    // Attribution de points à l'utilisateur
    await supabaseService.admin
      .from('User')
      .update({ 
        totalPoints: supabaseService.admin.raw('total_points + 10'),
        bamCount: supabaseService.admin.raw('bam_count + 1'),
        lastActivity: new Date().toISOString()
      })
      .eq('id', userId);

    // Notification des utilisateurs proches (rayon 10km)
    if (latitude && longitude) {
      try {
        const nearbyUsers = await supabaseService.findNearbyUsers(latitude, longitude, 10000);
        const notificationPromises = nearbyUsers.map(user => 
          supabaseService.sendPushNotification(user.id, {
            title: 'Nouveau BAM près de chez vous',
            body: `${category}: ${title}`,
            data: {
              bamId: bam.id,
              category,
              distance: user.distance_meters
            }
          })
        );
        
        await Promise.allSettled(notificationPromises);
      } catch (notifError) {
        console.warn('Erreur notifications proximité:', notifError.message);
      }
    }

    res.status(201).json({
      message: 'BAM créé avec succès',
      bam: {
        ...bam,
        attachments: attachments
      }
    });

  } catch (error) {
    console.error('Erreur POST /bams:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/bams/:id - Détails avec analytics
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query; // Pour tracking des vues

    const { data: bam, error } = await supabaseService.admin
      .from('Bam')
      .select(`
        *,
        user:User(id, username, totalPoints, currentLevel, createdAt),
        reviews:Review(*),
        calls:Call(*),
        attachments:BamAttachment(*),
        _count:Review(count)
      `)
      .eq('id', id)
      .single();

    if (error || !bam) {
      return res.status(404).json({ error: 'BAM non trouvé' });
    }

    // Enregistrer la vue (analytics)
    if (userId && userId !== bam.userId) {
      await supabaseService.admin
        .from('BamView')
        .upsert({
          bamId: id,
          userId,
          viewedAt: new Date().toISOString()
        }, {
          onConflict: 'bamId,userId'
        });
    }

    // Incrémenter le compteur de vues
    await supabaseService.admin
      .from('Bam')
      .update({ 
        viewCount: supabaseService.admin.raw('view_count + 1'),
        lastViewedAt: new Date().toISOString()
      })
      .eq('id', id);

    res.json({
      bam: {
        ...bam,
        viewCount: (bam.viewCount || 0) + 1
      }
    });

  } catch (error) {
    console.error('Erreur GET /bams/:id:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/bams/:id - Mise à jour avec historique
router.put('/:id', moderationMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, ...updateData } = req.body;

    // Vérifier les permissions
    const { data: existingBam } = await supabaseService.admin
      .from('Bam')
      .select('userId, status')
      .eq('id', id)
      .single();

    if (!existingBam) {
      return res.status(404).json({ error: 'BAM non trouvé' });
    }

    if (existingBam.userId !== userId) {
      return res.status(403).json({ error: 'Permission refusée' });
    }

    if (existingBam.status === 'resolved') {
      return res.status(400).json({ error: 'Impossible de modifier un BAM résolu' });
    }

    // Enregistrer l'historique avant modification
    await supabaseService.admin
      .from('BamHistory')
      .insert({
        bamId: id,
        userId,
        action: 'update',
        changes: updateData,
        timestamp: new Date().toISOString()
      });

    // Mise à jour
    const { data: updatedBam, error } = await supabaseService.admin
      .from('Bam')
      .update({
        ...updateData,
        updatedAt: new Date().toISOString(),
        moderationScore: req.body._moderationScore || existingBam.moderationScore
      })
      .eq('id', id)
      .select(`
        *,
        user:User(id, username, totalPoints, currentLevel)
      `)
      .single();

    if (error) {
      return res.status(500).json({ error: 'Erreur mise à jour' });
    }

    res.json({
      message: 'BAM mis à jour avec succès',
      bam: updatedBam
    });

  } catch (error) {
    console.error('Erreur PUT /bams/:id:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/bams/nearby - Recherche géographique avancée
router.get('/location/nearby', async (req, res) => {
  try {
    const { 
      lat, 
      lng, 
      radius = 1000,
      category,
      severity,
      limit = 10
    } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ 
        error: 'Latitude et longitude requises' 
      });
    }

    const nearbyBams = await supabaseService.admin.rpc('find_nearby_bams_detailed', {
      user_lat: parseFloat(lat),
      user_lng: parseFloat(lng),
      radius_meters: parseInt(radius),
      category_filter: category || null,
      severity_filter: severity || null,
      limit_count: parseInt(limit)
    });

    if (nearbyBams.error) {
      return res.status(500).json({ error: 'Erreur recherche géographique' });
    }

    res.json({
      bams: nearbyBams.data || [],
      searchCenter: { lat: parseFloat(lat), lng: parseFloat(lng) },
      radius: parseInt(radius)
    });

  } catch (error) {
    console.error('Erreur GET /bams/nearby:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// GET /api/bams/stats - Statistiques avancées
router.get('/analytics/stats', async (req, res) => {
  try {
    const { 
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate = new Date().toISOString().split('T')[0],
      category,
      userId
    } = req.query;

    const analytics = await supabaseService.getAnalytics(startDate, endDate);

    // Filtres supplémentaires
    let filteredAnalytics = analytics;
    
    if (category) {
      // Filtrer par catégorie si spécifié
      filteredAnalytics = {
        ...analytics,
        bams: {
          ...analytics.bams,
          total: analytics.bams.by_category[category] || 0
        }
      };
    }

    if (userId) {
      // Stats spécifiques à l'utilisateur
      const { data: userStats } = await supabaseService.admin
        .from('Bam')
        .select('id, createdAt, category, status, viewCount')
        .eq('userId', userId)
        .gte('createdAt', startDate)
        .lte('createdAt', endDate);

      filteredAnalytics.userStats = {
        totalBams: userStats?.length || 0,
        totalViews: userStats?.reduce((sum, bam) => sum + (bam.viewCount || 0), 0) || 0,
        byCategory: userStats?.reduce((acc, bam) => {
          acc[bam.category] = (acc[bam.category] || 0) + 1;
          return acc;
        }, {}) || {},
        byStatus: userStats?.reduce((acc, bam) => {
          acc[bam.status] = (acc[bam.status] || 0) + 1;
          return acc;
        }, {}) || {}
      };
    }

    res.json(filteredAnalytics);

  } catch (error) {
    console.error('Erreur GET /bams/stats:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;