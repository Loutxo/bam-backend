const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { validateBamCreation, validateMessage, handleValidationErrors } = require('../middleware/validation');
const { bamCreationLimiter, messageLimiter, searchLimiter } = require('../middleware/rateLimiting');
const { filterBamsByDistance, isValidCoordinates } = require('../utils/geolocation');
const pushService = require('../services/pushNotifications');
const GamificationService = require('../services/gamificationService');
const AutoModerationService = require('../services/autoModerationService');

const prisma = new PrismaClient();
const gamificationService = GamificationService; // Singleton, pas de new
const autoModerationService = new AutoModerationService();

// Créer un BAM
router.post('/', authenticateToken, bamCreationLimiter, validateBamCreation, handleValidationErrors, async (req, res) => {
  const { text, price, latitude, longitude, expiresInMinutes } = req.body;
  const userId = req.user.id; // Récupéré du token JWT

  try {
    // 🚨 Vérification auto-modération avant création
    try {
      const moderationResult = await autoModerationService.simulateModeration(text);
      
      if (moderationResult.wouldTrigger) {
        console.log(`🚨 BAM bloqué par auto-modération: ${moderationResult.recommendedAction}`);
        
        // Notification WebSocket pour l'utilisateur
        const webSocketService = req.app.get('webSocketService');
        if (webSocketService) {
          webSocketService.notifyAutoModeration(userId, {
            action: moderationResult.recommendedAction,
            reason: 'Contenu détecté par les filtres automatiques',
            severity: moderationResult.severity,
            rules: moderationResult.matchedRules?.map(r => r.name) || []
          });
        }
        
        // Actions selon la sévérité
        if (moderationResult.severity >= 8) {
          return res.status(403).json({
            error: 'Contenu non autorisé',
            message: 'Votre BAM contient du contenu inapproprié et ne peut pas être publié.',
            moderationTriggered: true
          });
        } else if (moderationResult.severity >= 5) {
          // Créer le BAM mais le marquer pour révision
          // Pour l'instant, on bloque aussi
          return res.status(403).json({
            error: 'Contenu signalé',
            message: 'Votre BAM nécessite une révision avant publication.',
            moderationTriggered: true
          });
        }
        // Sévérité < 5 : on laisse passer mais on log
      }
    } catch (moderationError) {
      console.error('Erreur auto-modération:', moderationError);
      // Ne pas bloquer la création pour une erreur de modération
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInMinutes * 60000);

    const bam = await prisma.bam.create({
      data: {
        userId,
        text,
        price,
        latitude,
        longitude,
        createdAt: now,
        expiresAt,
      },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            profileImageUrl: true,
            score: true,
          },
        },
      },
    });

    // 🎮 Attribution des points pour création de BAM
    try {
      const gamificationResult = await gamificationService.awardPoints(
        userId, 
        'BAM_CREATED',
        null,
        `BAM créé: "${text.substring(0, 30)}..."`,
        bam.id
      );
      console.log(`🎯 Points attribués pour création BAM: ${gamificationResult.pointsAwarded}`);
    } catch (gamificationError) {
      console.error('Erreur gamification lors création BAM:', gamificationError);
      // Ne pas faire échouer la création du BAM pour une erreur de gamification
    }

    res.json({
      message: 'BAM créé avec succès',
      bam,
    });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Erreur lors de la création du BAM' });
  }
});

// Voir les BAMs autour de soi
router.get('/nearby', optionalAuth, searchLimiter, async (req, res) => {
  const { lat, lng, radius } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: 'Paramètres lat et lng requis' });
  }

  // Validation des coordonnées
  if (!isValidCoordinates(parseFloat(lat), parseFloat(lng))) {
    return res.status(400).json({ error: 'Coordonnées invalides' });
  }

  try {
    const searchRadius = radius ? Math.min(parseFloat(radius), 10) : 2; // Max 10km

    // Récupérer tous les BAMs actifs avec les infos utilisateur (sans mot de passe)
    const bams = await prisma.bam.findMany({
      where: {
        expiresAt: {
          gt: new Date(),
        },
        // Exclure ses propres BAMs si authentifié
        ...(req.user && { userId: { not: req.user.id } }),
      },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            profileImageUrl: true,
            score: true,
          },
        },
        _count: {
          select: {
            responses: true,
          },
        },
      },
    });

    // Filtrer par distance et ajouter la distance
    const filtered = filterBamsByDistance(
      bams,
      parseFloat(lat),
      parseFloat(lng),
      searchRadius,
    );

    res.json({
      bams: filtered,
      total: filtered.length,
      radius: searchRadius,
      coordinates: { lat: parseFloat(lat), lng: parseFloat(lng) },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la recherche de BAMs' });
  }
});

// Répondre à un BAM
router.post('/:id/respond', authenticateToken, async (req, res) => {
  const bamId = req.params.id;
  const userId = req.user.id; // Récupéré du token JWT

  try {
    // Vérifie que le BAM existe
    const bam = await prisma.bam.findUnique({
      where: { id: bamId },
    });

    if (!bam) {
      return res.status(404).json({ error: 'BAM non trouvé' });
    }

    // Vérifie que l'utilisateur ne répond pas à son propre BAM
    if (bam.userId === userId) {
      return res.status(400).json({ error: 'Vous ne pouvez pas répondre à votre propre BAM' });
    }

    // Vérifie que le BAM n'est pas expiré
    if (bam.expiresAt <= new Date()) {
      return res.status(400).json({ error: 'Ce BAM a expiré' });
    }

    // Vérifie que la réponse n'existe pas déjà pour ce user
    const existing = await prisma.response.findFirst({
      where: { bamId, userId },
    });

    if (existing) {
      return res.status(400).json({ error: 'Vous avez déjà répondu à ce BAM' });
    }

    // Crée la réponse
    const response = await prisma.response.create({
      data: {
        bamId,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            profileImageUrl: true,
            score: true,
          },
        },
      },
    });

    // 🎮 Attribution des points pour rejoindre une BAM
    try {
      const gamificationResult = await gamificationService.awardPoints(
        userId, 
        'BAM_JOINED',
        null,
        `Rejoint la BAM: "${bam.text.substring(0, 30)}..."`,
        bamId
      );
      console.log(`🎯 Points attribués pour rejoindre BAM: ${gamificationResult.pointsAwarded}`);
    } catch (gamificationError) {
      console.error('Erreur gamification lors rejoindre BAM:', gamificationError);
      // Ne pas faire échouer la réponse pour une erreur de gamification
    }

    res.json({
      message: 'Réponse envoyée avec succès',
      response,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la réponse au BAM' });
  }
});

// Voir les réponses à un BAM (propriétaire uniquement)
router.get('/:id/responses', authenticateToken, async (req, res) => {
  const bamId = req.params.id;
  const userId = req.user.id;

  try {
    // Vérifier que l'utilisateur est le propriétaire du BAM
    const bam = await prisma.bam.findUnique({
      where: { id: bamId },
    });

    if (!bam) {
      return res.status(404).json({ error: 'BAM non trouvé' });
    }

    if (bam.userId !== userId) {
      return res.status(403).json({ error: 'Seul le propriétaire peut voir les réponses' });
    }

    const responses = await prisma.response.findMany({
      where: { bamId },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            profileImageUrl: true,
            score: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      responses,
      total: responses.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la récupération des réponses' });
  }
});

// Envoi d'un message entre demandeur et répondeur pour un BAM donné
router.post('/:id/messages', authenticateToken, messageLimiter, validateMessage, handleValidationErrors, async (req, res) => {
  const bamId = req.params.id;
  const { toUserId, text } = req.body;
  const fromUserId = req.user.id;

  try {
    // 1) BAM existe et encore valide ?
    const bam = await prisma.bam.findUnique({ where: { id: bamId } });
    if (!bam) return res.status(404).json({ error: 'BAM introuvable' });
    if (bam.expiresAt <= new Date()) return res.status(400).json({ error: 'BAM expiré' });

    // 2) Participants autorisés ? (émetteur du BAM + un répondeur)
    const isFromOwner = bam.userId === fromUserId;
    const isToOwner = bam.userId === toUserId;

    // y a-t-il une réponse du toUserId à ce BAM ?
    const hasResponseFromTo = await prisma.response.findFirst({
      where: { bamId, userId: toUserId },
    });
    const hasResponseFromFrom = await prisma.response.findFirst({
      where: { bamId, userId: fromUserId },
    });

    // autoriser les paires (owner <-> responder)
    const validPair =
      (isFromOwner && hasResponseFromTo) ||
      (isToOwner && hasResponseFromFrom);

    if (!validPair) {
      return res.status(403).json({ error: 'Participants non autorisés pour ce BAM' });
    }

    // 🚨 Vérification auto-modération avant création du message
    try {
      const moderationResult = await autoModerationService.simulateModeration(text);
      
      if (moderationResult.wouldTrigger) {
        console.log(`🚨 Message bloqué par auto-modération: ${moderationResult.recommendedAction}`);
        
        // Notification WebSocket pour l'utilisateur
        const webSocketService = req.app.get('webSocketService');
        if (webSocketService) {
          webSocketService.notifyAutoModeration(fromUserId, {
            action: moderationResult.recommendedAction,
            reason: 'Message détecté par les filtres automatiques',
            severity: moderationResult.severity,
            rules: moderationResult.matchedRules?.map(r => r.name) || []
          });
        }
        
        if (moderationResult.severity >= 7) {
          return res.status(403).json({
            error: 'Message non autorisé',
            message: 'Votre message contient du contenu inapproprié.',
            moderationTriggered: true
          });
        } else if (moderationResult.severity >= 4) {
          return res.status(403).json({
            error: 'Message signalé',
            message: 'Votre message nécessite une révision.',
            moderationTriggered: true
          });
        }
      }
    } catch (moderationError) {
      console.error('Erreur auto-modération message:', moderationError);
    }

    // 3) Créer le message
    const message = await prisma.message.create({
      data: { bamId, fromUserId, toUserId: toUserId, text },
      include: {
        fromUser: { select: { id: true, pseudo: true, profileImageUrl: true } },
        toUser: { select: { id: true, pseudo: true, profileImageUrl: true } },
      },
    });

    // 4) Envoyer notification push au destinataire
    try {
      await pushService.notifyNewMessage(bamId, text, fromUserId, [toUserId]);
      console.log(`✅ Notification envoyée pour message dans BAM ${bamId}`);
    } catch (notificationError) {
      console.error('❌ Erreur notification push:', notificationError.message);
      // Ne pas faire échouer la création du message pour une erreur de notification
    }

    // 5) Émettre l'événement WebSocket pour les utilisateurs en ligne
    try {
      const webSocketService = req.app.get('webSocketService');
      if (webSocketService) {
        // Émettre à tous les participants de la BAM (expéditeur et destinataire)
        webSocketService.emitToBam(bamId, 'new-message', {
          id: message.id,
          bamId: bamId,
          fromUserId: message.fromUserId,
          fromUser: message.fromUser,
          toUserId: message.toUserId,
          toUser: message.toUser,
          text: message.text,
          createdAt: message.createdAt,
          type: 'text'
        });

        console.log(`🔌 Message temps réel émis pour BAM ${bamId}`);
      }
    } catch (socketError) {
      console.error('❌ Erreur WebSocket:', socketError.message);
      // Ne pas faire échouer la création du message pour une erreur WebSocket
    }

    // 6) 🎮 Attribution des points pour envoi de message
    try {
      const gamificationResult = await gamificationService.awardPoints(
        fromUserId, 
        'MESSAGE_SENT',
        null,
        `Message envoyé dans BAM`,
        bamId
      );
      console.log(`🎯 +${gamificationResult.pointsAwarded} points pour message envoyé`);
    } catch (gamificationError) {
      console.error('Erreur gamification lors envoi message:', gamificationError);
      // Ne pas faire échouer le message pour une erreur de gamification
    }

    res.json({
      message: 'Message envoyé avec succès',
      data: message,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lors de l\'envoi du message' });
  }
});

// Récupère l'historique des messages d'un BAM (triés)
router.get('/:id/messages', authenticateToken, async (req, res) => {
  const bamId = req.params.id;
  const userId = req.user.id;

  try {
    // Vérifier que l'utilisateur est autorisé à voir ces messages
    const bam = await prisma.bam.findUnique({ where: { id: bamId } });
    if (!bam) return res.status(404).json({ error: 'BAM introuvable' });

    const isOwner = bam.userId === userId;
    const hasResponse = await prisma.response.findFirst({
      where: { bamId, userId },
    });

    if (!isOwner && !hasResponse) {
      return res.status(403).json({
        error: 'Accès refusé',
        message: 'Vous devez être le propriétaire ou avoir répondu au BAM',
      });
    }

    const messages = await prisma.message.findMany({
      where: {
        bamId,
        OR: [
          { fromUserId: userId },
          { toUserId: userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      include: {
        fromUser: { select: { id: true, pseudo: true, profileImageUrl: true } },
        toUser: { select: { id: true, pseudo: true, profileImageUrl: true } },
      },
    });

    res.json({
      messages,
      total: messages.length,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lors de la récupération des messages' });
  }
});

// Récupérer ses propres BAMs
router.get('/mine', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { status = 'active' } = req.query; // active, expired, all

  try {
    const whereCondition = { userId };

    if (status === 'active') {
      whereCondition.expiresAt = { gt: new Date() };
    } else if (status === 'expired') {
      whereCondition.expiresAt = { lte: new Date() };
    }

    const bams = await prisma.bam.findMany({
      where: whereCondition,
      include: {
        _count: {
          select: {
            responses: true,
            messages: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      bams,
      total: bams.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la récupération de vos BAMs' });
  }
});

module.exports = router;
