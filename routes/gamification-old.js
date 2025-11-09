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
      const publicStats = {
        user: stats.user,
        progression: stats.progression,
        // Ne pas inclure l'historique des transactions pour les autres utilisateurs
        recentTransactions: []
      };

      res.json({
        success: true,
        data: publicStats
      });

    } catch (error) {
      console.error('Erreur récupération stats points utilisateur:', error);
      if (error.message.includes('non trouvé')) {
        return res.status(404).json({
          success: false,
          error: 'Utilisateur non trouvé'
        });
      }
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des statistiques'
      });
    }
  }
);

/**
 * POST /api/points/award
 * Attribue des points manuellement (admin seulement)
 */
router.post('/award',
  authenticateToken,
  // TODO: Ajouter middleware admin quand il sera créé
  async (req, res) => {
    try {
      const { userId, points, reason, description } = req.body;
      
      if (!userId || !points || !reason) {
        return res.status(400).json({
          success: false,
          error: 'userId, points et reason sont requis'
        });
      }

      const result = await gamificationService.awardPoints(
        userId,
        'BONUS',
        points,
        description || `Points bonus attribués par admin: ${reason}`,
        null
      );

      res.json({
        success: true,
        message: 'Points attribués avec succès',
        data: result
      });

    } catch (error) {
      console.error('Erreur attribution points manuel:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'attribution des points'
      });
    }
  }
);

// ===========================================
// ROUTES BADGES
// ===========================================

/**
 * GET /api/badges
 * Récupère tous les badges disponibles
 */
router.get('/badges', authenticateToken, async (req, res) => {
  try {
    const badges = await gamificationService.prisma.badge.findMany({
      orderBy: [
        { category: 'asc' },
        { name: 'asc' }
      ],
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
        category: true,
        requirement: true,
        pointsReward: true,
        isSecret: true
      }
    });

    res.json({
      success: true,
      data: badges
    });

  } catch (error) {
    console.error('Erreur récupération badges:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des badges'
    });
  }
});

/**
 * GET /api/badges/my
 * Récupère les badges de l'utilisateur connecté
 */
router.get('/badges/my', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const userBadges = await gamificationService.prisma.userBadge.findMany({
      where: { userId },
      include: {
        badge: {
          select: {
            id: true,
            name: true,
            description: true,
            icon: true,
            category: true,
            pointsReward: true
          }
        }
      },
      orderBy: { earnedAt: 'desc' }
    });

    res.json({
      success: true,
      data: userBadges
    });

  } catch (error) {
    console.error('Erreur récupération badges utilisateur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de vos badges'
    });
  }
});

/**
 * GET /api/badges/user/:userId
 * Récupère les badges publics d'un autre utilisateur
 */
router.get('/badges/user/:userId',
  authenticateToken,
  param('userId').isUUID().withMessage('ID utilisateur invalide'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { userId } = req.params;
      
      const userBadges = await gamificationService.prisma.userBadge.findMany({
        where: { userId },
        include: {
          badge: {
            select: {
              id: true,
              name: true,
              description: true,
              icon: true,
              category: true,
              pointsReward: true,
              isSecret: true
            }
          }
        },
        orderBy: { earnedAt: 'desc' }
      });

      // Filtrer les badges secrets pour les autres utilisateurs
      const publicBadges = userBadges.filter(ub => !ub.badge.isSecret);

      res.json({
        success: true,
        data: publicBadges
      });

    } catch (error) {
      console.error('Erreur récupération badges utilisateur:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des badges'
      });
    }
  }
);

// ===========================================
// ROUTES ACHIEVEMENTS
// ===========================================

/**
 * GET /api/achievements
 * Récupère tous les achievements disponibles
 */
router.get('/achievements', authenticateToken, async (req, res) => {
  try {
    const achievements = await gamificationService.prisma.achievement.findMany({
      where: { isActive: true },
      orderBy: [
        { category: 'asc' },
        { target: 'asc' }
      ],
      select: {
        id: true,
        name: true,
        description: true,
        icon: true,
        category: true,
        target: true,
        pointsReward: true
      }
    });

    res.json({
      success: true,
      data: achievements
    });

  } catch (error) {
    console.error('Erreur récupération achievements:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des achievements'
    });
  }
});

/**
 * GET /api/achievements/my
 * Récupère les achievements de l'utilisateur connecté avec progression
 */
router.get('/achievements/my', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const userAchievements = await gamificationService.prisma.userAchievement.findMany({
      where: { userId },
      include: {
        achievement: {
          select: {
            id: true,
            name: true,
            description: true,
            icon: true,
            category: true,
            target: true,
            pointsReward: true
          }
        }
      },
      orderBy: [
        { completed: 'asc' },
        { progress: 'desc' }
      ]
    });

    // Enrichir avec pourcentage de progression
    const enrichedAchievements = userAchievements.map(ua => ({
      ...ua,
      progressPercentage: Math.min(100, Math.floor((ua.progress / ua.achievement.target) * 100))
    }));

    res.json({
      success: true,
      data: enrichedAchievements
    });

  } catch (error) {
    console.error('Erreur récupération achievements utilisateur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de vos achievements'
    });
  }
});

// ===========================================
// ROUTES LEADERBOARDS
// ===========================================

/**
 * GET /api/leaderboard/points
 * Récupère le classement global des points
 */
router.get('/leaderboard/points',
  authenticateToken,
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limite entre 1 et 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset doit être positif'),
  handleValidationErrors,
  async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const offset = parseInt(req.query.offset) || 0;
      
      const leaderboard = await gamificationService.getPointsLeaderboard(limit, offset);
      
      res.json({
        success: true,
        data: {
          leaderboard,
          pagination: {
            limit,
            offset,
            hasMore: leaderboard.length === limit
          }
        }
      });

    } catch (error) {
      console.error('Erreur récupération leaderboard:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération du classement'
      });
    }
  }
);

/**
 * GET /api/leaderboard/my-rank
 * Récupère la position de l'utilisateur connecté dans le classement
 */
router.get('/leaderboard/my-rank', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRank = await gamificationService.getUserRank(userId);
    
    res.json({
      success: true,
      data: userRank
    });

  } catch (error) {
    console.error('Erreur récupération rang utilisateur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération de votre rang'
    });
  }
});

// ===========================================
// ROUTES ADMIN/SETUP
// ===========================================

/**
 * POST /api/setup/initialize
 * Initialise les badges et achievements par défaut
 */
router.post('/setup/initialize',
  authenticateToken,
  // TODO: Ajouter middleware admin
  async (req, res) => {
    try {
      const result = await gamificationService.initializeDefaultData();
      
      res.json({
        success: true,
        message: 'Gamification initialisée avec succès',
        data: result
      });

    } catch (error) {
      console.error('Erreur initialisation gamification:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'initialisation'
      });
    }
  }
);

/**
 * GET /api/info
 * Informations générales sur le système de gamification
 */
router.get('/info', authenticateToken, async (req, res) => {
  try {
    const pointValues = GamificationService.POINT_VALUES;
    const levelThresholds = GamificationService.LEVEL_THRESHOLDS;
    
    // Statistiques générales
    const stats = await Promise.all([
      gamificationService.prisma.user.count(),
      gamificationService.prisma.badge.count(),
      gamificationService.prisma.achievement.count({ where: { isActive: true } }),
      gamificationService.prisma.pointTransaction.count()
    ]);

    res.json({
      success: true,
      data: {
        pointValues,
        levelThresholds,
        statistics: {
          totalUsers: stats[0],
          totalBadges: stats[1],
          activeAchievements: stats[2],
          totalPointTransactions: stats[3]
        }
      }
    });

  } catch (error) {
    console.error('Erreur récupération infos gamification:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des informations'
    });
  }
});

module.exports = router;