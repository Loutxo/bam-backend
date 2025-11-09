const admin = require('firebase-admin');
const { PrismaClient } = require('@prisma/client');
const config = require('../config');

const prisma = new PrismaClient();

class PushNotificationService {
  constructor() {
    this.isInitialized = false;
    this.initializeFirebase();
  }

  initializeFirebase() {
    try {
      // Vérifier si Firebase Admin est déjà initialisé
      if (admin.apps.length === 0) {
        // Configuration Firebase depuis les variables d'environnement
        const serviceAccount = {
          type: "service_account",
          project_id: process.env.FIREBASE_PROJECT_ID,
          private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
          private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          client_email: process.env.FIREBASE_CLIENT_EMAIL,
          client_id: process.env.FIREBASE_CLIENT_ID,
          auth_uri: "https://accounts.google.com/o/oauth2/auth",
          token_uri: "https://oauth2.googleapis.com/token",
          auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
          client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
        };

        // Initialiser Firebase Admin
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });

        this.isInitialized = true;
        console.log('✅ Firebase Admin SDK initialisé');
      }
    } catch (error) {
      console.error('❌ Erreur initialisation Firebase:', error.message);
      // En développement, continuer sans Firebase
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Mode développement : Firebase désactivé');
        this.isInitialized = false;
      } else {
        throw error;
      }
    }
  }

  /**
   * Enregistrer un token FCM pour un utilisateur
   */
  async registerToken(userId, fcmToken) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { 
          fcmToken: fcmToken,
          pushEnabled: true 
        },
      });

      console.log(`✅ Token FCM enregistré pour l'utilisateur ${userId}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Erreur enregistrement token:', error);
      throw new Error('Impossible d\'enregistrer le token de notification');
    }
  }

  /**
   * Supprimer le token FCM d'un utilisateur (déconnexion)
   */
  async unregisterToken(userId) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { 
          fcmToken: null 
        },
      });

      console.log(`✅ Token FCM supprimé pour l'utilisateur ${userId}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Erreur suppression token:', error);
      throw new Error('Impossible de supprimer le token de notification');
    }
  }

  /**
   * Envoyer une notification push à un utilisateur
   */
  async sendToUser(userId, notification) {
    if (!this.isInitialized) {
      console.log('🔄 Firebase non initialisé, notification ignorée');
      return { success: false, reason: 'Firebase not initialized' };
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { fcmToken: true, pushEnabled: true, pseudo: true }
      });

      if (!user || !user.fcmToken || !user.pushEnabled) {
        console.log(`ℹ️ Pas de token FCM ou notifications désactivées pour ${userId}`);
        return { success: false, reason: 'No FCM token or notifications disabled' };
      }

      const message = {
        token: user.fcmToken,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: {
          type: notification.type || 'general',
          userId: userId,
          ...notification.data
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        }
      };

      const response = await admin.messaging().send(message);
      console.log(`✅ Notification envoyée à ${user.pseudo} (${userId}):`, response);
      
      return { success: true, messageId: response };
    } catch (error) {
      console.error('❌ Erreur envoi notification:', error);
      
      // Si le token est invalide, le supprimer
      if (error.code === 'messaging/registration-token-not-registered' || 
          error.code === 'messaging/invalid-registration-token') {
        await this.unregisterToken(userId);
        console.log(`🧹 Token FCM invalide supprimé pour ${userId}`);
      }
      
      throw error;
    }
  }

  /**
   * Envoyer une notification à plusieurs utilisateurs
   */
  async sendToMultipleUsers(userIds, notification) {
    const results = [];
    
    for (const userId of userIds) {
      try {
        const result = await this.sendToUser(userId, notification);
        results.push({ userId, ...result });
      } catch (error) {
        results.push({ userId, success: false, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Notification nouveau message dans une BAM
   */
  async notifyNewMessage(bamId, messageText, fromUserId, toUserIds) {
    const fromUser = await prisma.user.findUnique({
      where: { id: fromUserId },
      select: { pseudo: true }
    });

    const bam = await prisma.bam.findUnique({
      where: { id: bamId },
      select: { text: true }
    });

    const notification = {
      title: `💬 Nouveau message de ${fromUser.pseudo}`,
      body: messageText.length > 100 ? 
        messageText.substring(0, 100) + '...' : 
        messageText,
      type: 'new_message',
      data: {
        bamId,
        fromUserId,
        messagePreview: messageText.substring(0, 50)
      }
    };

    return this.sendToMultipleUsers(toUserIds, notification);
  }

  /**
   * Notification nouvel appel
   */
  async notifyIncomingCall(callId, fromUserId, toUserId) {
    const fromUser = await prisma.user.findUnique({
      where: { id: fromUserId },
      select: { pseudo: true, photoUrl: true }
    });

    const notification = {
      title: `📞 Appel entrant`,
      body: `${fromUser.pseudo} vous appelle`,
      type: 'incoming_call',
      data: {
        callId,
        fromUserId,
        callerName: fromUser.pseudo,
        callerPhoto: fromUser.photoUrl
      }
    };

    return this.sendToUser(toUserId, notification);
  }

  /**
   * Notification nouvelle BAM à proximité
   */
  async notifyNearbyBam(bamId, userIds, distance) {
    const bam = await prisma.bam.findUnique({
      where: { id: bamId },
      include: { user: { select: { pseudo: true } } }
    });

    const notification = {
      title: `🎯 Nouvelle BAM à proximité`,
      body: `"${bam.text}" par ${bam.user.pseudo} (${distance}m)`,
      type: 'nearby_bam',
      data: {
        bamId,
        creatorId: bam.userId,
        distance: distance.toString()
      }
    };

    return this.sendToMultipleUsers(userIds, notification);
  }

  /**
   * Notification générale
   */
  async sendGeneralNotification(userIds, title, body, data = {}) {
    const notification = {
      title,
      body,
      type: 'general',
      data
    };

    return this.sendToMultipleUsers(userIds, notification);
  }

  /**
   * Mettre à jour les préférences de notification
   */
  async updateNotificationPreferences(userId, pushEnabled) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { pushEnabled }
      });

      return { success: true };
    } catch (error) {
      console.error('❌ Erreur mise à jour préférences:', error);
      throw new Error('Impossible de mettre à jour les préférences');
    }
  }
}

// Instance singleton
const pushService = new PushNotificationService();

module.exports = pushService;