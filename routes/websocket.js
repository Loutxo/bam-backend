const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { ApiError } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * GET /websocket/stats
 * Obtenir les statistiques des connexions WebSocket
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const webSocketService = req.app.get('webSocketService');
    
    if (!webSocketService) {
      throw new ApiError(503, 'Service WebSocket non disponible');
    }

    const stats = webSocketService.getStats();
    
    res.json({
      success: true,
      stats: {
        connectedUsers: stats.connectedUsers,
        activeBams: stats.activeBams,
        totalSockets: stats.totalSockets
      }
    });
  } catch (error) {
    console.error('Erreur récupération stats WebSocket:', error);
    throw error;
  }
});

/**
 * GET /websocket/presence/:userId
 * Vérifier si un utilisateur est en ligne
 */
router.get('/presence/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const webSocketService = req.app.get('webSocketService');
    
    if (!webSocketService) {
      throw new ApiError(503, 'Service WebSocket non disponible');
    }

    const isOnline = webSocketService.isUserOnline(userId);
    
    res.json({
      success: true,
      userId,
      isOnline,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erreur vérification présence:', error);
    throw error;
  }
});

/**
 * GET /websocket/bam/:bamId/online
 * Obtenir la liste des utilisateurs en ligne dans une BAM
 */
router.get('/bam/:bamId/online', authenticateToken, async (req, res) => {
  try {
    const { bamId } = req.params;
    const webSocketService = req.app.get('webSocketService');
    
    if (!webSocketService) {
      throw new ApiError(503, 'Service WebSocket non disponible');
    }

    const onlineUsers = webSocketService.getOnlineUsersInBam(bamId);
    
    res.json({
      success: true,
      bamId,
      onlineUsers,
      count: onlineUsers.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erreur récupération utilisateurs en ligne:', error);
    throw error;
  }
});

/**
 * POST /websocket/notify
 * Envoyer une notification temps réel à un utilisateur (admin/système)
 */
router.post('/notify', authenticateToken, async (req, res) => {
  try {
    const { targetUserId, event, data } = req.body;
    const webSocketService = req.app.get('webSocketService');
    
    if (!webSocketService) {
      throw new ApiError(503, 'Service WebSocket non disponible');
    }

    // Validation des paramètres
    if (!targetUserId || !event) {
      throw new ApiError(400, 'targetUserId et event sont requis');
    }

    const sent = webSocketService.emitToUser(targetUserId, event, {
      ...data,
      timestamp: new Date().toISOString(),
      from: 'system'
    });
    
    res.json({
      success: true,
      sent,
      targetUserId,
      event,
      message: sent ? 'Notification envoyée' : 'Utilisateur non connecté'
    });
  } catch (error) {
    console.error('Erreur envoi notification:', error);
    throw error;
  }
});

/**
 * POST /websocket/broadcast
 * Diffuser un message à tous les utilisateurs connectés (admin uniquement)
 */
router.post('/broadcast', authenticateToken, async (req, res) => {
  try {
    // TODO: Ajouter une vérification de rôle admin
    const { event, data } = req.body;
    const webSocketService = req.app.get('webSocketService');
    
    if (!webSocketService) {
      throw new ApiError(503, 'Service WebSocket non disponible');
    }

    if (!event) {
      throw new ApiError(400, 'event est requis');
    }

    // Émettre à tous les utilisateurs connectés
    webSocketService.io.emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
      from: 'admin'
    });
    
    const stats = webSocketService.getStats();
    
    res.json({
      success: true,
      event,
      broadcastTo: stats.connectedUsers,
      message: 'Message diffusé à tous les utilisateurs connectés'
    });
  } catch (error) {
    console.error('Erreur diffusion:', error);
    throw error;
  }
});

module.exports = router;