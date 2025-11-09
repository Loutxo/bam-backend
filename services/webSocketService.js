const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { config } = require('../config');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class WebSocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> { socketId, status, lastSeen }
    this.userSockets = new Map();    // socketId -> userId
    this.bamRooms = new Map();       // bamId -> Set of userIds
  }

  /**
   * Initialise le serveur WebSocket
   * @param {http.Server} server - Serveur HTTP Express
   */
  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    // Middleware d'authentification pour les connexions WebSocket
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Token d\'authentification requis'));
        }

        const decoded = jwt.verify(token, config.jwt.secret);
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { id: true, pseudo: true, lastSeen: true }
        });

        if (!user) {
          return next(new Error('Utilisateur non trouvé'));
        }

        socket.userId = user.id;
        socket.userPseudo = user.pseudo;
        next();
      } catch (error) {
        console.error('Erreur d\'authentification WebSocket:', error);
        next(new Error('Token invalide'));
      }
    });

    // Gestion des connexions
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    console.log('🔌 Service WebSocket initialisé');
  }

  /**
   * Gère une nouvelle connexion WebSocket
   * @param {Socket} socket - Socket de l'utilisateur connecté
   */
  async handleConnection(socket) {
    const userId = socket.userId;
    console.log(`👤 Utilisateur connecté: ${socket.userPseudo} (${userId})`);

    // Enregistrer la connexion
    this.connectedUsers.set(userId, {
      socketId: socket.id,
      status: 'online',
      lastSeen: new Date()
    });
    this.userSockets.set(socket.id, userId);

    // Mettre à jour le statut en base
    await this.updateUserStatus(userId, 'online');

    // Rejoindre les BAMs auxquelles l'utilisateur participe
    await this.joinUserBams(socket, userId);

    // Émettre le statut de présence aux contacts
    this.broadcastPresenceUpdate(userId, 'online');

    // Gestion des événements
    this.setupSocketEvents(socket);

    // Gestion de la déconnexion
    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });
  }

  /**
   * Configure les événements WebSocket pour un socket
   * @param {Socket} socket - Socket de l'utilisateur
   */
  setupSocketEvents(socket) {
    const userId = socket.userId;

    // Rejoindre une BAM spécifique
    socket.on('join-bam', async (bamId) => {
      try {
        await this.joinBam(socket, userId, bamId);
      } catch (error) {
        socket.emit('error', { message: 'Erreur lors de l\'accès à la BAM' });
      }
    });

    // Quitter une BAM
    socket.on('leave-bam', (bamId) => {
      this.leaveBam(socket, userId, bamId);
    });

    // Envoi de message dans une BAM
    socket.on('send-message', async (data) => {
      try {
        await this.handleNewMessage(socket, userId, data);
      } catch (error) {
        socket.emit('error', { message: 'Erreur lors de l\'envoi du message' });
      }
    });

    // Mise à jour du statut de typing
    socket.on('typing-start', (bamId) => {
      this.handleTypingStatus(socket, userId, bamId, true);
    });

    socket.on('typing-stop', (bamId) => {
      this.handleTypingStatus(socket, userId, bamId, false);
    });

    // Mise à jour du statut utilisateur
    socket.on('status-change', async (status) => {
      if (['online', 'away', 'busy'].includes(status)) {
        await this.updateUserPresence(userId, status);
      }
    });
  }

  /**
   * Fait rejoindre un utilisateur à toutes ses BAMs actives
   * @param {Socket} socket - Socket de l'utilisateur
   * @param {string} userId - ID de l'utilisateur
   */
  async joinUserBams(socket, userId) {
    try {
      const userBams = await prisma.bamParticipant.findMany({
        where: { 
          userId,
          bam: { statut: { in: ['active', 'en_cours'] } }
        },
        include: { bam: true }
      });

      for (const participant of userBams) {
        const bamId = participant.bamId;
        const bamRoom = `bam-${bamId}`;
        
        socket.join(bamRoom);
        
        if (!this.bamRooms.has(bamId)) {
          this.bamRooms.set(bamId, new Set());
        }
        this.bamRooms.get(bamId).add(userId);

        console.log(`👥 ${socket.userPseudo} a rejoint la BAM ${bamId}`);
      }
    } catch (error) {
      console.error('Erreur lors de l\'accès aux BAMs:', error);
    }
  }

  /**
   * Fait rejoindre un utilisateur à une BAM spécifique
   * @param {Socket} socket - Socket de l'utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {string} bamId - ID de la BAM
   */
  async joinBam(socket, userId, bamId) {
    // Vérifier que l'utilisateur peut accéder à cette BAM
    const participation = await prisma.bamParticipant.findFirst({
      where: {
        bamId,
        userId,
        bam: { statut: { in: ['active', 'en_cours'] } }
      },
      include: { bam: true }
    });

    if (!participation) {
      throw new Error('Accès non autorisé à cette BAM');
    }

    const bamRoom = `bam-${bamId}`;
    socket.join(bamRoom);

    if (!this.bamRooms.has(bamId)) {
      this.bamRooms.set(bamId, new Set());
    }
    this.bamRooms.get(bamId).add(userId);

    // Notifier les autres participants
    socket.to(bamRoom).emit('user-joined-bam', {
      userId,
      pseudo: socket.userPseudo,
      bamId
    });

    console.log(`👥 ${socket.userPseudo} a rejoint la BAM ${bamId}`);
  }

  /**
   * Fait quitter un utilisateur d'une BAM
   * @param {Socket} socket - Socket de l'utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {string} bamId - ID de la BAM
   */
  leaveBam(socket, userId, bamId) {
    const bamRoom = `bam-${bamId}`;
    socket.leave(bamRoom);

    if (this.bamRooms.has(bamId)) {
      this.bamRooms.get(bamId).delete(userId);
      if (this.bamRooms.get(bamId).size === 0) {
        this.bamRooms.delete(bamId);
      }
    }

    // Notifier les autres participants
    socket.to(bamRoom).emit('user-left-bam', {
      userId,
      pseudo: socket.userPseudo,
      bamId
    });

    console.log(`👋 ${socket.userPseudo} a quitté la BAM ${bamId}`);
  }

  /**
   * Gère l'envoi d'un nouveau message en temps réel
   * @param {Socket} socket - Socket de l'expéditeur
   * @param {string} userId - ID de l'expéditeur
   * @param {Object} data - Données du message
   */
  async handleNewMessage(socket, userId, data) {
    const { bamId, content, type = 'text' } = data;

    // Vérifier l'accès à la BAM
    const participation = await prisma.bamParticipant.findFirst({
      where: {
        bamId,
        userId,
        bam: { statut: { in: ['active', 'en_cours'] } }
      }
    });

    if (!participation) {
      throw new Error('Accès non autorisé à cette BAM');
    }

    // Le message sera créé via l'API REST habituelle
    // Ici on émet juste l'événement temps réel
    const bamRoom = `bam-${bamId}`;
    
    const messageData = {
      bamId,
      senderId: userId,
      senderPseudo: socket.userPseudo,
      content,
      type,
      timestamp: new Date().toISOString(),
      tempId: data.tempId // Pour la synchronisation côté client
    };

    // Émettre le message à tous les participants de la BAM
    this.io.to(bamRoom).emit('new-message', messageData);

    console.log(`💬 Nouveau message de ${socket.userPseudo} dans BAM ${bamId}`);
  }

  /**
   * Gère le statut de frappe (typing)
   * @param {Socket} socket - Socket de l'utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {string} bamId - ID de la BAM
   * @param {boolean} isTyping - Statut de frappe
   */
  handleTypingStatus(socket, userId, bamId, isTyping) {
    const bamRoom = `bam-${bamId}`;
    
    socket.to(bamRoom).emit('typing-status', {
      userId,
      pseudo: socket.userPseudo,
      bamId,
      isTyping
    });
  }

  /**
   * Met à jour le statut de présence d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {string} status - Nouveau statut (online, away, busy)
   */
  async updateUserPresence(userId, status) {
    if (this.connectedUsers.has(userId)) {
      this.connectedUsers.get(userId).status = status;
      await this.updateUserStatus(userId, status);
      this.broadcastPresenceUpdate(userId, status);
    }
  }

  /**
   * Met à jour le statut utilisateur en base de données
   * @param {string} userId - ID de l'utilisateur
   * @param {string} status - Statut à enregistrer
   */
  async updateUserStatus(userId, status) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { 
          lastSeen: new Date(),
          // Note: ajouter un champ 'status' au schéma si nécessaire
        }
      });
    } catch (error) {
      console.error('Erreur mise à jour statut utilisateur:', error);
    }
  }

  /**
   * Diffuse la mise à jour de présence aux contacts de l'utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {string} status - Nouveau statut
   */
  broadcastPresenceUpdate(userId, status) {
    // Émettre à tous les utilisateurs connectés (pour l'instant)
    // TODO: Optimiser pour ne notifier que les contacts/participants des mêmes BAMs
    this.io.emit('presence-update', {
      userId,
      status,
      lastSeen: new Date().toISOString()
    });
  }

  /**
   * Gère la déconnexion d'un utilisateur
   * @param {Socket} socket - Socket qui se déconnecte
   */
  async handleDisconnection(socket) {
    const userId = this.userSockets.get(socket.id);
    
    if (userId) {
      console.log(`👤 Utilisateur déconnecté: ${socket.userPseudo} (${userId})`);

      // Nettoyer les maps
      this.connectedUsers.delete(userId);
      this.userSockets.delete(socket.id);

      // Retirer des BAMs
      for (const [bamId, users] of this.bamRooms.entries()) {
        users.delete(userId);
        if (users.size === 0) {
          this.bamRooms.delete(bamId);
        }
      }

      // Mettre à jour le statut
      await this.updateUserStatus(userId, 'offline');
      this.broadcastPresenceUpdate(userId, 'offline');
    }
  }

  /**
   * Émet un événement à un utilisateur spécifique
   * @param {string} userId - ID de l'utilisateur cible
   * @param {string} event - Nom de l'événement
   * @param {Object} data - Données à envoyer
   */
  emitToUser(userId, event, data) {
    const userConnection = this.connectedUsers.get(userId);
    if (userConnection) {
      this.io.to(userConnection.socketId).emit(event, data);
      return true;
    }
    return false;
  }

  /**
   * Émet un événement à tous les participants d'une BAM
   * @param {string} bamId - ID de la BAM
   * @param {string} event - Nom de l'événement
   * @param {Object} data - Données à envoyer
   */
  emitToBam(bamId, event, data) {
    const bamRoom = `bam-${bamId}`;
    this.io.to(bamRoom).emit(event, data);
  }

  /**
   * Retourne les statistiques de connexion
   */
  getStats() {
    return {
      connectedUsers: this.connectedUsers.size,
      activeBams: this.bamRooms.size,
      totalSockets: this.io ? this.io.sockets.sockets.size : 0
    };
  }

  /**
   * Vérifie si un utilisateur est en ligne
   * @param {string} userId - ID de l'utilisateur
   * @returns {boolean}
   */
  isUserOnline(userId) {
    return this.connectedUsers.has(userId);
  }

  /**
   * Retourne les utilisateurs en ligne dans une BAM
   * @param {string} bamId - ID de la BAM
   * @returns {Array}
   */
  getOnlineUsersInBam(bamId) {
    const users = this.bamRooms.get(bamId) || new Set();
    return Array.from(users).filter(userId => this.connectedUsers.has(userId));
  }

  // =============================================================================
  // NOTIFICATIONS DE SIGNALEMENT
  // =============================================================================

  /**
   * Notifie un utilisateur qu'il a été signalé
   * @param {string} targetUserId - ID de l'utilisateur signalé
   * @param {Object} reportData - Données du signalement
   */
  notifyUserReported(targetUserId, reportData) {
    if (this.isUserOnline(targetUserId)) {
      const userConnection = this.connectedUsers.get(targetUserId);
      this.io.to(userConnection.socketId).emit('user:reported', {
        type: 'USER_REPORTED',
        message: `Vous avez été signalé pour ${reportData.category}`,
        category: reportData.category,
        reportId: reportData.id,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Notifie un utilisateur qu'il a reçu une sanction
   * @param {string} userId - ID de l'utilisateur sanctionné
   * @param {Object} sanctionData - Données de la sanction
   */
  notifyUserSanctioned(userId, sanctionData) {
    if (this.isUserOnline(userId)) {
      const userConnection = this.connectedUsers.get(userId);
      this.io.to(userConnection.socketId).emit('user:sanctioned', {
        type: 'USER_SANCTIONED',
        sanction: sanctionData,
        timestamp: new Date().toISOString()
      });

      // Si c'est un bannissement, forcer la déconnexion
      if (sanctionData.type === 'permanent_ban') {
        setTimeout(() => {
          const socket = this.io.sockets.sockets.get(userConnection.socketId);
          if (socket) {
            socket.emit('user:banned', {
              type: 'USER_BANNED',
              message: 'Vous avez été banni de la plateforme',
              reason: sanctionData.reason
            });
            socket.disconnect(true);
          }
        }, 1000);
      }
    }
  }

  /**
   * Notifie les modérateurs d'un nouveau signalement
   * @param {Object} reportData - Données du signalement
   */
  notifyModerators(reportData) {
    this.io.emit('moderation:new-report', {
      type: 'NEW_REPORT',
      report: reportData,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Notifie l'auteur d'un signalement du changement de statut
   * @param {string} reporterId - ID de l'auteur du signalement
   * @param {Object} reportData - Données du signalement mis à jour
   */
  notifyReportStatusUpdate(reporterId, reportData) {
    if (this.isUserOnline(reporterId)) {
      const userConnection = this.connectedUsers.get(reporterId);
      this.io.to(userConnection.socketId).emit('report:status-updated', {
        type: 'REPORT_STATUS_UPDATED',
        report: reportData,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Notifie l'auto-modération d'un contenu
   * @param {string} userId - ID de l'utilisateur concerné
   * @param {Object} moderationData - Données de la modération automatique
   */
  notifyAutoModeration(userId, moderationData) {
    if (this.isUserOnline(userId)) {
      const userConnection = this.connectedUsers.get(userId);
      this.io.to(userConnection.socketId).emit('content:auto-moderated', {
        type: 'CONTENT_AUTO_MODERATED',
        action: moderationData.action,
        reason: moderationData.reason,
        severity: moderationData.severity,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Notifie la suppression d'un BAM suite à un signalement
   * @param {string} bamId - ID du BAM supprimé
   * @param {string} ownerId - ID du propriétaire du BAM
   * @param {string} reason - Raison de la suppression
   */
  notifyBamRemoved(bamId, ownerId, reason) {
    // Notifier le propriétaire
    if (this.isUserOnline(ownerId)) {
      const userConnection = this.connectedUsers.get(ownerId);
      this.io.to(userConnection.socketId).emit('bam:removed', {
        type: 'BAM_REMOVED',
        bamId,
        reason,
        timestamp: new Date().toISOString()
      });
    }

    // Notifier tous les participants dans la room
    const bamRoom = `bam-${bamId}`;
    this.io.to(bamRoom).emit('bam:removed', {
      type: 'BAM_REMOVED',
      bamId,
      reason: 'Ce BAM a été supprimé suite à un signalement',
      timestamp: new Date().toISOString()
    });

    // Nettoyer la room
    this.bamRooms.delete(bamId);
  }

  /**
   * Diffuse les statistiques de modération aux administrateurs
   * @param {Object} stats - Statistiques de modération
   */
  broadcastModerationStats(stats) {
    this.io.emit('moderation:stats-update', {
      type: 'MODERATION_STATS_UPDATE',
      stats,
      timestamp: new Date().toISOString()
    });
  }

  // =============================================================================
  // NOTIFICATIONS GAMIFICATION
  // =============================================================================

  /**
   * Notifier l'obtention d'un nouveau badge
   */
  notifyBadgeEarned(userId, badgeData) {
    const userRoom = `user_${userId}`;
    this.io.to(userRoom).emit('badgeEarned', {
      badge: badgeData.badge,
      pointsEarned: badgeData.pointsEarned,
      timestamp: new Date()
    });
  }

  /**
   * Notifier une mise à jour de streak
   */
  notifyStreakUpdate(userId, streakData) {
    const userRoom = `user_${userId}`;
    this.io.to(userRoom).emit('streakUpdate', {
      currentStreak: streakData.currentStreak,
      longestStreak: streakData.longestStreak,
      bonusEarned: streakData.bonusEarned,
      timestamp: new Date()
    });
  }

  /**
   * Notifier un changement de niveau
   */
  notifyLevelUp(userId, levelData) {
    const userRoom = `user_${userId}`;
    this.io.to(userRoom).emit('levelUp', {
      newLevel: levelData.newLevel,
      pointsEarned: levelData.pointsEarned,
      unlockedFeatures: levelData.unlockedFeatures || [],
      timestamp: new Date()
    });
  }

  /**
   * Notifier l'obtention d'un achievement
   */
  notifyAchievementUnlocked(userId, achievementData) {
    const userRoom = `user_${userId}`;
    this.io.to(userRoom).emit('achievementUnlocked', {
      achievement: achievementData.achievement,
      pointsEarned: achievementData.pointsEarned,
      timestamp: new Date()
    });
  }

  /**
   * Notifier une position dans le leaderboard
   */
  notifyLeaderboardUpdate(userId, positionData) {
    const userRoom = `user_${userId}`;
    this.io.to(userRoom).emit('leaderboardUpdate', {
      position: positionData.position,
      improvement: positionData.improvement, // nombre de places gagnées/perdues
      category: positionData.category,
      timestamp: new Date()
    });
  }

  // =============================================================================
  // NOTIFICATIONS DE GÉOLOCALISATION
  // =============================================================================

  /**
   * Notifier un événement de géofence (entrée/sortie de zone)
   */
  notifyGeofenceEvent(userId, eventData) {
    const userRoom = `user_${userId}`;
    this.io.to(userRoom).emit('geofenceEvent', {
      type: eventData.type, // 'zone_enter' ou 'zone_exit'
      zone: eventData.zone,
      duration: eventData.duration, // pour les sorties
      timestamp: eventData.timestamp
    });

    console.log(`📡 Événement géofence envoyé à ${userId}: ${eventData.type} - ${eventData.zone.name}`);
  }

  /**
   * Notifier une alerte de proximité
   */
  notifyProximityAlert(userId, alertData) {
    const userRoom = `user_${userId}`;
    this.io.to(userRoom).emit('proximityAlert', {
      type: alertData.type, // 'bam_nearby', 'user_nearby'
      target: alertData.bam || alertData.user,
      distance: alertData.distance,
      timestamp: alertData.timestamp
    });

    console.log(`📡 Alerte de proximité envoyée à ${userId}: ${alertData.type} à ${alertData.distance}m`);
  }

  /**
   * Notifier une nouvelle alerte géofence
   */
  notifyGeofenceAlert(userId, alertData) {
    const userRoom = `user_${userId}`;
    this.io.to(userRoom).emit('geofenceAlert', {
      id: alertData.id,
      type: alertData.type,
      title: alertData.title,
      message: alertData.message,
      zone: alertData.zone,
      timestamp: alertData.timestamp
    });

    console.log(`📡 Alerte géofence envoyée à ${userId}: ${alertData.title}`);
  }

  /**
   * Diffuser les mises à jour de position (pour les amis/followers)
   */
  broadcastLocationUpdate(userId, locationData, targetUserIds = []) {
    targetUserIds.forEach(targetUserId => {
      const userRoom = `user_${targetUserId}`;
      this.io.to(userRoom).emit('friendLocationUpdate', {
        userId,
        location: {
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          accuracy: locationData.accuracy,
          city: locationData.city,
          timestamp: locationData.timestamp
        }
      });
    });

    if (targetUserIds.length > 0) {
      console.log(`📡 Position de ${userId} diffusée à ${targetUserIds.length} amis`);
    }
  }

  /**
   * Notifier les modifications de zones favorites
   */
  notifyZoneUpdate(userId, zoneData, action) {
    const userRoom = `user_${userId}`;
    this.io.to(userRoom).emit('zoneUpdate', {
      action, // 'created', 'updated', 'deleted'
      zone: zoneData,
      timestamp: new Date()
    });

    console.log(`📡 Zone ${action} notifiée à ${userId}: ${zoneData.name || zoneData.id}`);
  }
}

// Export du singleton
const webSocketService = new WebSocketService();
module.exports = webSocketService;