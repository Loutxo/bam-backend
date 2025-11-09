/**
 * Routes pour le système de gamification avancé
 * Points, badges, achievements, leaderboards, streaks
 */

const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const gamificationService = require('../services/gamificationService');

const router = express.Router();

// =============================================================================
// POINTS ET NIVEAUX
// =============================================================================

/**
 * GET /api/gamification/points/:userId
 * Obtenir les points et le niveau d'un utilisateur
 */
router.get('/points/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Vérifier que l'utilisateur peut voir ces informations
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

/**
 * GET /api/gamification/level/:userId
 * Obtenir les informations de niveau d'un utilisateur
 */
router.get('/level/:userId', authMiddleware, async (req, res) => {
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

/**
 * GET /api/gamification/badges
 * Obtenir tous les badges disponibles
 */
router.get('/badges', authMiddleware, async (req, res) => {
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

/**
 * GET /api/gamification/badges/user/:userId
 * Obtenir les badges d'un utilisateur
 */
router.get('/badges/user/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Accès non autorisé' 
      });
    }

    const userBadges = await gamificationService.getUserBadges(userId);
    
    res.json({
      success: true,
      data: userBadges
    });
  } catch (error) {
    console.error('Erreur récupération badges utilisateur:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des badges'
    });
  }
});

/**
 * POST /api/gamification/badges/check/:userId
 * Vérifier et attribuer de nouveaux badges
 */
router.post('/badges/check/:userId', authMiddleware, async (req, res) => {
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
// ACHIEVEMENTS
// =============================================================================

/**
 * GET /api/gamification/achievements
 * Obtenir tous les achievements disponibles
 */
router.get('/achievements', authMiddleware, async (req, res) => {
  try {
    const achievements = await gamificationService.getAllAchievements();
    
    res.json({
      success: true,
      data: achievements
    });
  } catch (error) {
    console.error('Erreur récupération achievements:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des achievements'
    });
  }
});

/**
 * GET /api/gamification/achievements/user/:userId
 * Obtenir les achievements d'un utilisateur
 */
router.get('/achievements/user/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Accès non autorisé' 
      });
    }

    const userAchievements = await gamificationService.getUserAchievements(userId);
    
    res.json({
      success: true,
      data: userAchievements
    });
  } catch (error) {
    console.error('Erreur récupération achievements utilisateur:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des achievements'
    });
  }
});

// =============================================================================
// STREAKS QUOTIDIENNES
// =============================================================================

/**
 * GET /api/gamification/streak/:userId
 * Obtenir les informations de streak d'un utilisateur
 */
router.get('/streak/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Accès non autorisé' 
      });
    }

    const streakInfo = await gamificationService.getUserStreak(userId);
    
    res.json({
      success: true,
      data: streakInfo
    });
  } catch (error) {
    console.error('Erreur récupération streak:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération du streak'
    });
  }
});

/**
 * POST /api/gamification/streak/login/:userId
 * Traiter la connexion quotidienne
 */
router.post('/streak/login/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (req.user.id !== userId) {
      return res.status(403).json({ 
        error: 'Accès non autorisé' 
      });
    }

    const loginResult = await gamificationService.processDailyLogin(userId);
    
    res.json({
      success: true,
      data: loginResult
    });
  } catch (error) {
    console.error('Erreur traitement connexion:', error);
    res.status(500).json({
      error: 'Erreur lors du traitement de la connexion'
    });
  }
});

// =============================================================================
// LEADERBOARDS
// =============================================================================

/**
 * GET /api/gamification/leaderboard/points
 * Obtenir le classement par points
 */
router.get('/leaderboard/points', authMiddleware, async (req, res) => {
  try {
    const { limit = 10, period = 'ALL_TIME' } = req.query;
    
    const leaderboard = await gamificationService.getPointsLeaderboard(
      parseInt(limit), 
      period
    );
    
    res.json({
      success: true,
      data: leaderboard
    });
  } catch (error) {
    console.error('Erreur récupération leaderboard:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération du classement'
    });
  }
});

/**
 * GET /api/gamification/leaderboard/position/:userId
 * Obtenir la position d'un utilisateur dans le classement
 */
router.get('/leaderboard/position/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const position = await gamificationService.getUserLeaderboardPosition(userId);
    
    res.json({
      success: true,
      data: position
    });
  } catch (error) {
    console.error('Erreur récupération position:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération de la position'
    });
  }
});

// =============================================================================
// STATISTIQUES COMPLÈTES
// =============================================================================

/**
 * GET /api/gamification/stats/:userId
 * Obtenir les statistiques complètes de gamification
 */
router.get('/stats/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Accès non autorisé' 
      });
    }

    const stats = await gamificationService.getUserGamificationStats(userId);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Erreur récupération stats:', error);
    res.status(500).json({
      error: 'Erreur lors de la récupération des statistiques'
    });
  }
});

// =============================================================================
// ACTIONS UTILISATEUR (WEBHOOK INTERNE)
// =============================================================================

/**
 * POST /api/gamification/action
 * Traiter une action utilisateur pour la gamification
 */
router.post('/action', authMiddleware, async (req, res) => {
  try {
    const { userId, action, data } = req.body;
    
    if (!userId || !action) {
      return res.status(400).json({
        error: 'userId et action sont requis'
      });
    }

    // Seul l'utilisateur concerné ou un admin peut déclencher des actions
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
// ADMINISTRATION (ADMIN SEULEMENT)
// =============================================================================

/**
 * POST /api/gamification/admin/init-badges
 * Initialiser les badges par défaut
 */
router.post('/admin/init-badges', authMiddleware, async (req, res) => {
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

/**
 * POST /api/gamification/admin/award-badge
 * Attribuer manuellement un badge
 */
router.post('/admin/award-badge', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Accès admin requis' 
      });
    }

    const { userId, badgeId } = req.body;
    
    if (!userId || !badgeId) {
      return res.status(400).json({
        error: 'userId et badgeId sont requis'
      });
    }

    const userBadge = await gamificationService.awardBadge(userId, badgeId);
    
    res.json({
      success: true,
      data: userBadge
    });
  } catch (error) {
    console.error('Erreur attribution badge:', error);
    res.status(500).json({
      error: 'Erreur lors de l\'attribution du badge'
    });
  }
});

/**
 * POST /api/gamification/admin/add-points
 * Ajouter des points manuellement
 */
router.post('/admin/add-points', authMiddleware, async (req, res) => {
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