/**
 * Routes Admin Dashboard
 * Statistiques et gestion administrative de la plateforme BAM
 */

const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Middleware de validation des erreurs
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Données invalides',
      errors: errors.array()
    });
  }
  next();
};

// Middleware pour vérifier les droits admin
const requireAdmin = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, pseudo: true, email: true, isAdmin: true, isModerator: true }
    });

    if (!user || (!user.isAdmin && !user.isModerator)) {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Droits administrateur requis.'
      });
    }

    req.admin = user;
    next();
  } catch (error) {
    console.error('Erreur vérification droits admin:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur de vérification des droits'
    });
  }
};

// =============================================================================
// STATISTIQUES GÉNÉRALES
// =============================================================================

/**
 * GET /api/admin/dashboard/stats
 * Statistiques générales de la plateforme
 */
router.get('/dashboard/stats', [auth, requireAdmin], async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers, // Connectés dans les 7 derniers jours
      totalBAMs,
      activeBAMs, // BAMs non expirées
      totalMessages,
      totalReports,
      pendingReports,
      totalSanctions
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: {
          lastSeen: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      prisma.bam.count(),
      prisma.bam.count({
        where: {
          expiresAt: { gt: new Date() }
        }
      }),
      prisma.message.count(),
      prisma.report.count(),
      prisma.report.count({
        where: { status: 'PENDING' }
      }),
      prisma.userSanction.count({
        where: { isActive: true }
      })
    ]);

    // Statistiques par jour (30 derniers jours)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyStats = await prisma.user.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: { gte: thirtyDaysAgo }
      },
      _count: true
    });

    // Créer un tableau avec tous les jours
    const dailyRegistrations = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayStats = dailyStats.filter(stat => 
        stat.createdAt.toISOString().split('T')[0] === dateStr
      );
      
      return {
        date: dateStr,
        registrations: dayStats.reduce((sum, stat) => sum + stat._count, 0)
      };
    }).reverse();

    // Top villes
    const topCities = await prisma.locationHistory.groupBy({
      by: ['city'],
      where: {
        city: { not: null },
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      },
      _count: true,
      orderBy: { _count: { city: 'desc' } },
      take: 10
    });

    const stats = {
      overview: {
        totalUsers,
        activeUsers,
        totalBAMs,
        activeBAMs,
        totalMessages,
        userGrowthRate: activeUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(1) : 0
      },
      moderation: {
        totalReports,
        pendingReports,
        totalSanctions,
        reportResolutionRate: totalReports > 0 ? (((totalReports - pendingReports) / totalReports) * 100).toFixed(1) : 100
      },
      charts: {
        dailyRegistrations,
        topCities: topCities.map(city => ({
          city: city.city,
          count: city._count
        }))
      },
      lastUpdated: new Date()
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Erreur récupération stats admin:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
});

// =============================================================================
// GESTION DES UTILISATEURS
// =============================================================================

/**
 * GET /api/admin/users
 * Liste des utilisateurs avec filtres
 */
router.get('/users', [
  auth,
  requireAdmin,
  query('page').optional().isInt({ min: 1 }).withMessage('Page invalide'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limite invalide'),
  query('search').optional().isString().trim(),
  query('status').optional().isIn(['active', 'banned', 'warned']).withMessage('Statut invalide'),
  query('sortBy').optional().isIn(['createdAt', 'lastSeen', 'pseudo']).withMessage('Tri invalide'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Ordre invalide'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      status, 
      sortBy = 'createdAt', 
      sortOrder = 'desc' 
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Construire les filtres
    let whereClause = {};
    
    if (search) {
      whereClause.OR = [
        { pseudo: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (status === 'banned') {
      whereClause.sanctions = {
        some: {
          type: 'BAN',
          isActive: true
        }
      };
    } else if (status === 'warned') {
      whereClause.sanctions = {
        some: {
          type: 'WARNING',
          isActive: true
        }
      };
    }

    const [users, totalUsers] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        include: {
          _count: {
            select: {
              bams: true,
              messages: true,
              reports: true
            }
          },
          sanctions: {
            where: { isActive: true },
            select: { type: true, reason: true, createdAt: true }
          }
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: parseInt(limit)
      }),
      prisma.user.count({ where: whereClause })
    ]);

    res.json({
      success: true,
      data: {
        users: users.map(user => ({
          id: user.id,
          pseudo: user.pseudo,
          email: user.email,
          createdAt: user.createdAt,
          lastSeen: user.lastSeen,
          isAdmin: user.isAdmin,
          isModerator: user.isModerator,
          stats: user._count,
          activeSanctions: user.sanctions
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalUsers,
          pages: Math.ceil(totalUsers / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Erreur récupération utilisateurs admin:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des utilisateurs'
    });
  }
});

/**
 * PUT /api/admin/users/:userId/role
 * Modifier le rôle d'un utilisateur
 */
router.put('/users/:userId/role', [
  auth,
  requireAdmin,
  param('userId').isString().withMessage('ID utilisateur invalide'),
  body('isAdmin').optional().isBoolean(),
  body('isModerator').optional().isBoolean(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { userId } = req.params;
    const { isAdmin, isModerator } = req.body;

    // Vérifier que l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, pseudo: true, isAdmin: true, isModerator: true }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Empêcher l'auto-modification des droits admin (sécurité)
    if (userId === req.admin.id && isAdmin === false) {
      return res.status(403).json({
        success: false,
        message: 'Vous ne pouvez pas retirer vos propres droits administrateur'
      });
    }

    const updateData = {};
    if (typeof isAdmin === 'boolean') updateData.isAdmin = isAdmin;
    if (typeof isModerator === 'boolean') updateData.isModerator = isModerator;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, pseudo: true, isAdmin: true, isModerator: true }
    });

    // Log de l'action administrative
    console.log(`🔧 Admin ${req.admin.pseudo} a modifié les droits de ${user.pseudo}: isAdmin=${isAdmin}, isModerator=${isModerator}`);

    res.json({
      success: true,
      data: updatedUser,
      message: 'Droits utilisateur modifiés avec succès'
    });
  } catch (error) {
    console.error('Erreur modification rôle utilisateur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la modification du rôle'
    });
  }
});

// =============================================================================
// MODÉRATION RAPIDE
// =============================================================================

/**
 * GET /api/admin/moderation/queue
 * File d'attente de modération
 */
router.get('/moderation/queue', [auth, requireAdmin], async (req, res) => {
  try {
    const [
      pendingReports,
      recentSanctions,
      flaggedContent
    ] = await Promise.all([
      // Reports en attente
      prisma.report.findMany({
        where: { status: 'PENDING' },
        include: {
          reporter: { select: { pseudo: true } },
          reportedUser: { select: { pseudo: true } },
          reportedBam: { 
            select: { text: true, user: { select: { pseudo: true } } }
          },
          reportedMessage: {
            select: { text: true, user: { select: { pseudo: true } } }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),

      // Sanctions récentes
      prisma.userSanction.findMany({
        where: { isActive: true },
        include: {
          user: { select: { pseudo: true } },
          moderator: { select: { pseudo: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      }),

      // Contenu potentiellement problématique (nouveaux BAMs avec mots-clés suspects)
      prisma.bam.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Dernières 24h
          }
        },
        include: {
          user: { select: { pseudo: true } },
          _count: { select: { reports: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ]);

    res.json({
      success: true,
      data: {
        pendingReports,
        recentSanctions,
        flaggedContent: flaggedContent.map(bam => ({
          ...bam,
          needsReview: bam._count.reports > 0 || 
                      /\b(spam|fake|scam|arnaque)\b/i.test(bam.text)
        }))
      }
    });
  } catch (error) {
    console.error('Erreur récupération queue modération:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la file de modération'
    });
  }
});

// =============================================================================
// ANALYTICS
// =============================================================================

/**
 * GET /api/admin/analytics/usage
 * Analytics d'utilisation de la plateforme
 */
router.get('/analytics/usage', [auth, requireAdmin], async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      dailyActiveUsers,
      popularLocations,
      peakHours,
      deviceStats
    ] = await Promise.all([
      // Utilisateurs actifs par jour (7 derniers jours)
      prisma.user.groupBy({
        by: ['lastSeen'],
        where: {
          lastSeen: { gte: sevenDaysAgo }
        },
        _count: true
      }),

      // Lieux populaires
      prisma.locationHistory.groupBy({
        by: ['city'],
        where: {
          city: { not: null },
          createdAt: { gte: sevenDaysAgo }
        },
        _count: true,
        orderBy: { _count: { city: 'desc' } },
        take: 5
      }),

      // Heures de pointe (analyse des créations de BAMs)
      prisma.bam.findMany({
        where: {
          createdAt: { gte: sevenDaysAgo }
        },
        select: { createdAt: true }
      }),

      // Statistiques approximatives des appareils (basé sur les sources de localisation)
      prisma.locationHistory.groupBy({
        by: ['source'],
        where: {
          createdAt: { gte: sevenDaysAgo }
        },
        _count: true
      })
    ]);

    // Traiter les heures de pointe
    const hourCounts = Array(24).fill(0);
    peakHours.forEach(bam => {
      const hour = bam.createdAt.getHours();
      hourCounts[hour]++;
    });

    const peakHoursData = hourCounts.map((count, hour) => ({
      hour: `${hour}:00`,
      count
    }));

    res.json({
      success: true,
      data: {
        dailyActiveUsers: dailyActiveUsers.length,
        popularLocations: popularLocations.map(loc => ({
          city: loc.city,
          visits: loc._count
        })),
        peakHours: peakHoursData,
        deviceStats: deviceStats.map(stat => ({
          source: stat.source,
          count: stat._count
        }))
      }
    });
  } catch (error) {
    console.error('Erreur récupération analytics usage:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des analytics'
    });
  }
});

module.exports = router;