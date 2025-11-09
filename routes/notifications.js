const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const pushService = require('../services/pushNotifications');
const { ApiError } = require('../middleware/errorHandler');

const router = express.Router();

// Validation du token FCM
const validateFcmToken = [
  body('fcmToken')
    .trim()
    .notEmpty()
    .withMessage('Token FCM requis')
    .isLength({ min: 100, max: 300 })
    .withMessage('Format de token FCM invalide'),
];

/**
 * POST /notifications/register
 * Enregistrer un token FCM pour l'utilisateur connecté
 */
router.post('/register', authenticateToken, validateFcmToken, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, 'Token FCM invalide', errors.array());
    }

    const { fcmToken } = req.body;
    const userId = req.user.id;

    await pushService.registerToken(userId, fcmToken);

    res.status(200).json({
      message: 'Token de notification enregistré avec succès',
      pushEnabled: true
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /notifications/unregister
 * Supprimer le token FCM (déconnexion)
 */
router.delete('/unregister', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;

    await pushService.unregisterToken(userId);

    res.status(200).json({
      message: 'Token de notification supprimé avec succès'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /notifications/preferences
 * Mettre à jour les préférences de notifications
 */
router.put('/preferences', authenticateToken, [
  body('pushEnabled')
    .isBoolean()
    .withMessage('pushEnabled doit être un booléen')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ApiError(400, 'Données invalides', errors.array());
    }

    const { pushEnabled } = req.body;
    const userId = req.user.id;

    await pushService.updateNotificationPreferences(userId, pushEnabled);

    res.status(200).json({
      message: 'Préférences de notification mises à jour',
      pushEnabled
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /notifications/preferences
 * Récupérer les préférences de notifications de l'utilisateur
 */
router.get('/preferences', authenticateToken, async (req, res, next) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { 
        pushEnabled: true, 
        fcmToken: true 
      }
    });

    if (!user) {
      throw new ApiError(404, 'Utilisateur non trouvé');
    }

    res.status(200).json({
      pushEnabled: user.pushEnabled,
      hasToken: !!user.fcmToken
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /notifications/test
 * Envoyer une notification de test (développement seulement)
 */
if (process.env.NODE_ENV === 'development') {
  router.post('/test', authenticateToken, [
    body('title').trim().notEmpty().withMessage('Titre requis'),
    body('body').trim().notEmpty().withMessage('Corps du message requis')
  ], async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ApiError(400, 'Données invalides', errors.array());
      }

      const { title, body, data = {} } = req.body;
      const userId = req.user.id;

      const result = await pushService.sendToUser(userId, {
        title,
        body,
        type: 'test',
        data
      });

      res.status(200).json({
        message: 'Notification de test envoyée',
        result
      });
    } catch (error) {
      next(error);
    }
  });
}

module.exports = router;