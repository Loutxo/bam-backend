const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const ReportingService = require('../services/reportingService');

const router = express.Router();
const reportingService = new ReportingService();

// Middleware de validation des erreurs
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Données invalides',
      details: errors.array()
    });
  }
  next();
};

// Middleware pour vérifier si l'utilisateur est modérateur
const requireModerator = async (req, res, next) => {
  // TODO: Implémenter la logique de vérification des permissions modérateur
  // Pour l'instant, on accepte tous les utilisateurs authentifiés
  next();
};

// =============================================================================
// CRÉATION DE SIGNALEMENTS
// =============================================================================

/**
 * POST /api/reports/user
 * Signaler un utilisateur
 */
router.post('/user', 
  authenticateToken,
  [
    body('targetUserId').isUUID().withMessage('ID utilisateur invalide'),
    body('category').isIn([
      'SPAM', 'HARASSMENT', 'HATE_SPEECH', 'INAPPROPRIATE', 
      'SCAM', 'FAKE_PROFILE', 'VIOLENCE', 'OTHER'
    ]).withMessage('Catégorie invalide'),
    body('reason').isLength({ min: 10, max: 500 }).withMessage('Raison requise (10-500 caractères)'),
    body('description').optional().isLength({ max: 1000 }).withMessage('Description trop longue (max 1000 caractères)'),
    body('evidence').optional().isURL().withMessage('Evidence doit être une URL valide')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { targetUserId, category, reason, description, evidence } = req.body;
      const reporterId = req.user.id;

      const report = await reportingService.reportUser(
        reporterId,
        targetUserId,
        category,
        reason,
        description,
        evidence
      );

      res.status(201).json({
        success: true,
        message: 'Signalement d\'utilisateur créé avec succès',
        data: report
      });

    } catch (error) {
      console.error('Erreur création signalement utilisateur:', error);
      
      if (error.message.includes('Impossible de se signaler') || 
          error.message.includes('déjà signalé') ||
          error.message.includes('introuvable')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Erreur lors de la création du signalement'
      });
    }
  }
);

/**
 * POST /api/reports/bam
 * Signaler un BAM
 */
router.post('/bam',
  authenticateToken,
  [
    body('targetBamId').isUUID().withMessage('ID BAM invalide'),
    body('category').isIn([
      'SPAM', 'HARASSMENT', 'HATE_SPEECH', 'INAPPROPRIATE', 
      'SCAM', 'FAKE_PROFILE', 'VIOLENCE', 'OTHER'
    ]).withMessage('Catégorie invalide'),
    body('reason').isLength({ min: 10, max: 500 }).withMessage('Raison requise (10-500 caractères)'),
    body('description').optional().isLength({ max: 1000 }).withMessage('Description trop longue'),
    body('evidence').optional().isURL().withMessage('Evidence doit être une URL valide')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { targetBamId, category, reason, description, evidence } = req.body;
      const reporterId = req.user.id;

      const report = await reportingService.reportBam(
        reporterId,
        targetBamId,
        category,
        reason,
        description,
        evidence
      );

      res.status(201).json({
        success: true,
        message: 'Signalement de BAM créé avec succès',
        data: report
      });

    } catch (error) {
      console.error('Erreur création signalement BAM:', error);
      
      if (error.message.includes('Impossible de signaler') || 
          error.message.includes('déjà signalé') ||
          error.message.includes('introuvable')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Erreur lors de la création du signalement'
      });
    }
  }
);

/**
 * POST /api/reports/message
 * Signaler un message
 */
router.post('/message',
  authenticateToken,
  [
    body('targetMessageId').isUUID().withMessage('ID message invalide'),
    body('category').isIn([
      'SPAM', 'HARASSMENT', 'HATE_SPEECH', 'INAPPROPRIATE', 
      'SCAM', 'FAKE_PROFILE', 'VIOLENCE', 'OTHER'
    ]).withMessage('Catégorie invalide'),
    body('reason').isLength({ min: 10, max: 500 }).withMessage('Raison requise (10-500 caractères)'),
    body('description').optional().isLength({ max: 1000 }).withMessage('Description trop longue'),
    body('evidence').optional().isURL().withMessage('Evidence doit être une URL valide')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { targetMessageId, category, reason, description, evidence } = req.body;
      const reporterId = req.user.id;

      const report = await reportingService.reportMessage(
        reporterId,
        targetMessageId,
        category,
        reason,
        description,
        evidence
      );

      res.status(201).json({
        success: true,
        message: 'Signalement de message créé avec succès',
        data: report
      });

    } catch (error) {
      console.error('Erreur création signalement message:', error);
      
      if (error.message.includes('Impossible de signaler') || 
          error.message.includes('déjà signalé') ||
          error.message.includes('introuvable') ||
          error.message.includes('ne pouvez signaler')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Erreur lors de la création du signalement'
      });
    }
  }
);

// =============================================================================
// CONSULTATION SIGNALEMENTS
// =============================================================================

/**
 * GET /api/reports/my
 * Récupérer ses propres signalements
 */
router.get('/my',
  authenticateToken,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page doit être un entier positif'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit doit être entre 1 et 50')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const result = await reportingService.getUserReports(userId, page, limit);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Erreur récupération signalements utilisateur:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des signalements'
      });
    }
  }
);

/**
 * GET /api/reports/:id
 * Récupérer un signalement spécifique
 */
router.get('/:id',
  authenticateToken,
  [
    param('id').isUUID().withMessage('ID signalement invalide')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const reportId = req.params.id;
      const userId = req.user.id;

      const report = await reportingService.prisma.report.findUnique({
        where: { id: reportId },
        include: {
          reporter: { select: { id: true, pseudo: true } },
          targetUser: { select: { id: true, pseudo: true } },
          targetBam: { 
            select: { 
              id: true, 
              text: true, 
              user: { select: { id: true, pseudo: true } }
            } 
          },
          targetMessage: { 
            select: { 
              id: true, 
              text: true, 
              fromUser: { select: { id: true, pseudo: true } }
            } 
          },
          reviewedByUser: { select: { id: true, pseudo: true } }
        }
      });

      if (!report) {
        return res.status(404).json({
          success: false,
          error: 'Signalement introuvable'
        });
      }

      // Vérifier que l'utilisateur peut voir ce signalement
      if (report.reporterId !== userId) {
        return res.status(403).json({
          success: false,
          error: 'Accès non autorisé à ce signalement'
        });
      }

      res.json({
        success: true,
        data: report
      });

    } catch (error) {
      console.error('Erreur récupération signalement:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération du signalement'
      });
    }
  }
);

// =============================================================================
// STATUT UTILISATEUR ET SANCTIONS
// =============================================================================

/**
 * GET /api/reports/sanctions/my
 * Récupérer ses sanctions actives
 */
router.get('/sanctions/my',
  authenticateToken,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const sanctions = await reportingService.getUserActiveSanctions(userId);

      res.json({
        success: true,
        data: {
          activeSanctions: sanctions,
          isBanned: sanctions.some(s => ['TEMPORARY_BAN', 'PERMANENT_BAN'].includes(s.type))
        }
      });

    } catch (error) {
      console.error('Erreur récupération sanctions:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des sanctions'
      });
    }
  }
);

/**
 * GET /api/reports/check-ban/:userId
 * Vérifier si un utilisateur est banni (usage interne)
 */
router.get('/check-ban/:userId',
  authenticateToken,
  requireModerator,
  [
    param('userId').isUUID().withMessage('ID utilisateur invalide')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const userId = req.params.userId;
      const isBanned = await reportingService.isUserBanned(userId);
      const sanctions = await reportingService.getUserActiveSanctions(userId);

      res.json({
        success: true,
        data: {
          userId,
          isBanned,
          activeSanctions: sanctions
        }
      });

    } catch (error) {
      console.error('Erreur vérification ban:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la vérification'
      });
    }
  }
);

// =============================================================================
// MODÉRATION (ADMIN)
// =============================================================================

/**
 * GET /api/reports/moderation
 * Récupérer les signalements pour modération (admin)
 */
router.get('/moderation',
  authenticateToken,
  requireModerator,
  [
    query('status').optional().isIn(['PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED', 'ESCALATED']),
    query('category').optional().isIn(['SPAM', 'HARASSMENT', 'HATE_SPEECH', 'INAPPROPRIATE', 'SCAM', 'FAKE_PROFILE', 'VIOLENCE', 'OTHER']),
    query('type').optional().isIn(['USER', 'BAM', 'MESSAGE']),
    query('dateFrom').optional().isISO8601().withMessage('Date invalide'),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const filters = {
        status: req.query.status,
        category: req.query.category,
        type: req.query.type,
        dateFrom: req.query.dateFrom
      };

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const result = await reportingService.getReportsForModeration(filters, page, limit);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Erreur récupération signalements modération:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des signalements'
      });
    }
  }
);

/**
 * PUT /api/reports/:id/process
 * Traiter un signalement (admin)
 */
router.put('/:id/process',
  authenticateToken,
  requireModerator,
  [
    param('id').isUUID().withMessage('ID signalement invalide'),
    body('status').isIn(['REVIEWING', 'RESOLVED', 'DISMISSED', 'ESCALATED']).withMessage('Statut invalide'),
    body('actionTaken').optional().isIn([
      'WARNING', 'TEMP_BAN_1H', 'TEMP_BAN_24H', 'TEMP_BAN_7D', 
      'PERMANENT_BAN', 'CHAT_RESTRICT', 'DELETE_CONTENT', 'NO_ACTION'
    ]).withMessage('Action invalide'),
    body('adminNotes').optional().isLength({ max: 1000 }).withMessage('Notes trop longues')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const reportId = req.params.id;
      const moderatorId = req.user.id;
      const { status, actionTaken, adminNotes } = req.body;

      const processedReport = await reportingService.processReport(
        reportId,
        moderatorId,
        status,
        actionTaken,
        adminNotes
      );

      res.json({
        success: true,
        message: 'Signalement traité avec succès',
        data: processedReport
      });

    } catch (error) {
      console.error('Erreur traitement signalement:', error);
      
      if (error.message.includes('introuvable') || error.message.includes('déjà été traité')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Erreur lors du traitement du signalement'
      });
    }
  }
);

/**
 * GET /api/reports/stats
 * Statistiques de modération (admin)
 */
router.get('/stats',
  authenticateToken,
  requireModerator,
  async (req, res) => {
    try {
      const stats = await reportingService.getModerationStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('Erreur récupération statistiques:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des statistiques'
      });
    }
  }
);

/**
 * POST /api/reports/sanctions/manual
 * Émettre une sanction manuelle (admin)
 */
router.post('/sanctions/manual',
  authenticateToken,
  requireModerator,
  [
    body('userId').isUUID().withMessage('ID utilisateur invalide'),
    body('type').isIn(['WARNING', 'TEMPORARY_BAN', 'PERMANENT_BAN', 'CHAT_RESTRICT', 'POST_RESTRICT']).withMessage('Type de sanction invalide'),
    body('reason').isLength({ min: 10, max: 500 }).withMessage('Raison requise (10-500 caractères)'),
    body('duration').optional().isInt({ min: 1 }).withMessage('Durée doit être un entier positif'),
    body('description').optional().isLength({ max: 1000 }).withMessage('Description trop longue')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { userId, type, reason, duration, description } = req.body;
      const moderatorId = req.user.id;

      let sanction;
      
      switch (type) {
        case 'WARNING':
          sanction = await reportingService.issueWarning(userId, reason, moderatorId);
          break;
        case 'TEMPORARY_BAN':
          if (!duration) {
            return res.status(400).json({
              success: false,
              error: 'Durée requise pour un ban temporaire'
            });
          }
          sanction = await reportingService.issueTempBan(userId, duration, reason, moderatorId);
          break;
        case 'PERMANENT_BAN':
          sanction = await reportingService.issuePermanentBan(userId, reason, moderatorId);
          break;
        case 'CHAT_RESTRICT':
          const chatDuration = duration || 24; // 24h par défaut
          sanction = await reportingService.issueChatRestriction(userId, chatDuration, reason, moderatorId);
          break;
        default:
          return res.status(400).json({
            success: false,
            error: 'Type de sanction non supporté'
          });
      }

      res.status(201).json({
        success: true,
        message: 'Sanction émise avec succès',
        data: sanction
      });

    } catch (error) {
      console.error('Erreur émission sanction:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'émission de la sanction'
      });
    }
  }
);

module.exports = router;