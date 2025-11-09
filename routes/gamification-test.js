/**
 * Routes de gamification pour les tests
 */

const express = require('express');
const gamificationService = require('../services/gamificationService');

const router = express.Router();

// Middleware d'auth simplifié pour les tests
const testAuthMiddleware = (req, res, next) => {
  req.user = {
    id: req.headers['test-user-id'] || 'test-user-id',
    pseudo: 'TestUser',
    role: req.headers['test-user-role'] || 'user'
  };
  next();
};

// =============================================================================
// POINTS ET NIVEAUX
// =============================================================================

router.get('/points/:userId', testAuthMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Accès non autorisé à ces informations' 
      });
    }

    const pointsInfo = await gamificationService.getUserPointsInfo(userId);
    
    res.json({
      success: true,
      data: pointsInfo
    });
  } catch (error) {
    console.error('Erreur récupération points:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des points'
    });
  }
});

router.get('/level/:userId', testAuthMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Accès non autorisé' 
      });
    }

    const levelInfo = await gamificationService.getUserLevel(userId);
    
    res.json({
      success: true,
      data: levelInfo
    });
  } catch (error) {
    console.error('Erreur récupération niveau:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération du niveau'
    });
  }
});

// =============================================================================
// BADGES
// =============================================================================

router.get('/badges', testAuthMiddleware, async (req, res) => {
  try {
    const { category, rarity } = req.query;
    
    const filters = {};
    if (category) filters.category = category;
    if (rarity) filters.rarity = rarity;
    
    const badges = await gamificationService.getAllBadges(filters);
    
    res.json({
      success: true,
      data: badges
    });
  } catch (error) {
    console.error('Erreur récupération badges:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des badges'
    });
  }
});

router.post('/badges/check/:userId', testAuthMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Accès non autorisé' 
      });
    }

    const newBadges = await gamificationService.checkAdvancedBadges(userId);
    
    res.json({
      success: true,
      data: {
        newBadges,
        count: newBadges.length
      }
    });
  } catch (error) {
    console.error('Erreur vérification badges:', error);
    res.status(500).json({
      error: 'Erreur lors de la vérification des badges'
    });
  }
});

// =============================================================================
// ACTIONS UTILISATEUR
// =============================================================================

router.post('/action', testAuthMiddleware, async (req, res) => {
  try {
    const { userId, action, data } = req.body;
    
    if (!userId || !action) {
      return res.status(400).json({
        error: 'userId et action sont requis'
      });
    }

    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Accès non autorisé' 
      });
    }

    const result = await gamificationService.handleUserAction(userId, action, data);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Erreur traitement action:', error);
    res.status(500).json({
      error: 'Erreur lors du traitement de l\'action'
    });
  }
});

// =============================================================================
// ADMINISTRATION
// =============================================================================

router.post('/admin/init-badges', testAuthMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Accès admin requis' 
      });
    }

    const badges = await gamificationService.initializeAdvancedBadges();
    
    res.json({
      success: true,
      data: {
        count: badges.length,
        badges
      }
    });
  } catch (error) {
    console.error('Erreur initialisation badges:', error);
    res.status(500).json({
      error: 'Erreur lors de l\'initialisation des badges'
    });
  }
});

router.post('/admin/add-points', testAuthMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Accès admin requis' 
      });
    }

    const { userId, points, reason } = req.body;
    
    if (!userId || !points || !reason) {
      return res.status(400).json({
        error: 'userId, points et reason sont requis'
      });
    }

    const result = await gamificationService.addPoints(userId, points, reason);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Erreur ajout points:', error);
    res.status(500).json({
      error: 'Erreur lors de l\'ajout des points'
    });
  }
});

module.exports = router;