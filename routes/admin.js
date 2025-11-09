const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const AutoModerationService = require('../services/autoModerationService');

const router = express.Router();
const autoModerationService = new AutoModerationService();

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

// Middleware pour vérifier si l'utilisateur est admin
const requireAdmin = async (req, res, next) => {
  // TODO: Implémenter la logique de vérification admin
  // Pour l'instant, on accepte tous les utilisateurs authentifiés
  next();
};

// =============================================================================
// GESTION DES RÈGLES D'AUTO-MODÉRATION
// =============================================================================

/**
 * GET /api/admin/auto-moderation/rules
 * Récupérer toutes les règles d'auto-modération
 */
router.get('/rules',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const rules = await autoModerationService.getAllRules();

      res.json({
        success: true,
        data: rules
      });

    } catch (error) {
      console.error('Erreur récupération règles auto-modération:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des règles'
      });
    }
  }
);

/**
 * POST /api/admin/auto-moderation/rules
 * Créer une nouvelle règle d'auto-modération
 */
router.post('/rules',
  authenticateToken,
  requireAdmin,
  [
    body('name').isLength({ min: 3, max: 100 }).withMessage('Nom requis (3-100 caractères)'),
    body('description').isLength({ min: 10, max: 500 }).withMessage('Description requise (10-500 caractères)'),
    body('pattern').isLength({ min: 1, max: 1000 }).withMessage('Pattern requis (max 1000 caractères)'),
    body('action').isIn(['FLAG', 'HIDE', 'DELETE', 'WARN_USER', 'TEMP_BAN']).withMessage('Action invalide'),
    body('severity').isInt({ min: 1, max: 10 }).withMessage('Sévérité doit être entre 1 et 10'),
    body('isActive').optional().isBoolean().withMessage('isActive doit être un booléen')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const ruleData = req.body;
      const rule = await autoModerationService.createCustomRule(ruleData);

      res.status(201).json({
        success: true,
        message: 'Règle d\'auto-modération créée avec succès',
        data: rule
      });

    } catch (error) {
      console.error('Erreur création règle auto-modération:', error);
      
      if (error.code === 'P2002' && error.meta?.target?.includes('name')) {
        return res.status(400).json({
          success: false,
          error: 'Une règle avec ce nom existe déjà'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Erreur lors de la création de la règle'
      });
    }
  }
);

/**
 * PUT /api/admin/auto-moderation/rules/:id
 * Mettre à jour une règle d'auto-modération
 */
router.put('/rules/:id',
  authenticateToken,
  requireAdmin,
  [
    param('id').isUUID().withMessage('ID règle invalide'),
    body('name').optional().isLength({ min: 3, max: 100 }).withMessage('Nom invalide (3-100 caractères)'),
    body('description').optional().isLength({ min: 10, max: 500 }).withMessage('Description invalide (10-500 caractères)'),
    body('pattern').optional().isLength({ min: 1, max: 1000 }).withMessage('Pattern invalide (max 1000 caractères)'),
    body('action').optional().isIn(['FLAG', 'HIDE', 'DELETE', 'WARN_USER', 'TEMP_BAN']).withMessage('Action invalide'),
    body('severity').optional().isInt({ min: 1, max: 10 }).withMessage('Sévérité doit être entre 1 et 10'),
    body('isActive').optional().isBoolean().withMessage('isActive doit être un booléen')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const ruleId = req.params.id;
      const updates = req.body;
      
      const updatedRule = await autoModerationService.updateRule(ruleId, updates);

      res.json({
        success: true,
        message: 'Règle mise à jour avec succès',
        data: updatedRule
      });

    } catch (error) {
      console.error('Erreur mise à jour règle:', error);
      
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          error: 'Règle introuvable'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Erreur lors de la mise à jour de la règle'
      });
    }
  }
);

/**
 * PUT /api/admin/auto-moderation/rules/:id/toggle
 * Activer/désactiver une règle
 */
router.put('/rules/:id/toggle',
  authenticateToken,
  requireAdmin,
  [
    param('id').isUUID().withMessage('ID règle invalide'),
    body('isActive').isBoolean().withMessage('isActive requis et doit être un booléen')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const ruleId = req.params.id;
      const { isActive } = req.body;
      
      const updatedRule = await autoModerationService.toggleRule(ruleId, isActive);

      res.json({
        success: true,
        message: `Règle ${isActive ? 'activée' : 'désactivée'} avec succès`,
        data: updatedRule
      });

    } catch (error) {
      console.error('Erreur activation/désactivation règle:', error);
      
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          error: 'Règle introuvable'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Erreur lors de la modification de la règle'
      });
    }
  }
);

/**
 * DELETE /api/admin/auto-moderation/rules/:id
 * Supprimer une règle d'auto-modération
 */
router.delete('/rules/:id',
  authenticateToken,
  requireAdmin,
  [
    param('id').isUUID().withMessage('ID règle invalide')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const ruleId = req.params.id;
      await autoModerationService.deleteRule(ruleId);

      res.json({
        success: true,
        message: 'Règle supprimée avec succès'
      });

    } catch (error) {
      console.error('Erreur suppression règle:', error);
      
      if (error.code === 'P2025') {
        return res.status(404).json({
          success: false,
          error: 'Règle introuvable'
        });
      }

      res.status(500).json({
        success: false,
        error: 'Erreur lors de la suppression de la règle'
      });
    }
  }
);

// =============================================================================
// INITIALISATION ET STATISTIQUES
// =============================================================================

/**
 * POST /api/admin/auto-moderation/initialize
 * Initialiser les règles par défaut
 */
router.post('/initialize',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const createdRules = await autoModerationService.initializeDefaultRules();

      res.json({
        success: true,
        message: 'Règles d\'auto-modération initialisées avec succès',
        data: {
          rulesCreated: createdRules.length,
          rules: createdRules
        }
      });

    } catch (error) {
      console.error('Erreur initialisation règles:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'initialisation des règles'
      });
    }
  }
);

/**
 * GET /api/admin/auto-moderation/stats
 * Statistiques des règles d'auto-modération
 */
router.get('/stats',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const stats = await autoModerationService.getRulesStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('Erreur récupération stats auto-modération:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des statistiques'
      });
    }
  }
);

// =============================================================================
// OUTILS DE TEST
// =============================================================================

/**
 * POST /api/admin/auto-moderation/test
 * Tester l'auto-modération sur du contenu
 */
router.post('/test',
  authenticateToken,
  requireAdmin,
  [
    body('content').isLength({ min: 1, max: 5000 }).withMessage('Contenu requis (max 5000 caractères)')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { content } = req.body;
      const result = await autoModerationService.simulateModeration(content);

      res.json({
        success: true,
        data: {
          content,
          moderation: result
        }
      });

    } catch (error) {
      console.error('Erreur test auto-modération:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors du test d\'auto-modération'
      });
    }
  }
);

/**
 * POST /api/admin/auto-moderation/test-rule
 * Tester une règle spécifique
 */
router.post('/test-rule',
  authenticateToken,
  requireAdmin,
  [
    body('content').isLength({ min: 1, max: 5000 }).withMessage('Contenu requis (max 5000 caractères)'),
    body('pattern').isLength({ min: 1, max: 1000 }).withMessage('Pattern requis (max 1000 caractères)')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { content, pattern } = req.body;
      const matches = autoModerationService.testRule(content, pattern);

      res.json({
        success: true,
        data: {
          content,
          pattern,
          matches
        }
      });

    } catch (error) {
      console.error('Erreur test règle:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors du test de la règle'
      });
    }
  }
);

module.exports = router;