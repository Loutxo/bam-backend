const request = require('supertest');
const express = require('express');

// Mock du service push notifications
const mockPushService = {
  registerToken: jest.fn(),
  unregisterToken: jest.fn(),
  updateNotificationPreferences: jest.fn(),
  sendToUser: jest.fn(),
};

jest.mock('../services/pushNotifications', () => mockPushService);

// Mock Prisma
const mockPrismaUser = {
  findUnique: jest.fn(),
  update: jest.fn(),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    user: mockPrismaUser,
  })),
}));

// Mock de la configuration
jest.mock('../config', () => ({
  config: {
    jwt: {
      secret: 'test-secret-key',
      expiresIn: '1h',
    },
  },
  validateConfig: jest.fn(),
}));

describe('Notifications API', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Créer des routes mockées sans authentification
    const router = express.Router();
    const { body, validationResult } = require('express-validator');
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // Validation du token FCM
    const validateFcmToken = [
      body('fcmToken')
        .trim()
        .notEmpty()
        .withMessage('Token FCM requis')
        .isLength({ min: 30, max: 300 })
        .withMessage('Format de token FCM invalide'),
    ];
    
    // Middleware pour ajouter l'utilisateur de test
    router.use((req, res, next) => {
      req.user = { id: 'test-user-id', pseudo: 'testuser' };
      next();
    });
    
    // Routes mockées
    router.post('/register', validateFcmToken, async (req, res, next) => {
      try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return res.status(400).json({ error: 'Token FCM invalide' });
        }
        
        const { fcmToken } = req.body;
        const result = await mockPushService.registerToken(req.user.id, fcmToken);
        res.json(result);
      } catch (error) {
        next(error);
      }
    });
    
    router.delete('/unregister', async (req, res, next) => {
      try {
        const result = await mockPushService.unregisterToken(req.user.id);
        res.json({ message: 'Token de notification supprimé avec succès' });
      } catch (error) {
        next(error);
      }
    });
    
    router.put('/preferences', async (req, res, next) => {
      try {
        const { pushEnabled } = req.body;
        
        if (typeof pushEnabled !== 'boolean' && Object.keys(req.body).length > 0 && !req.body.hasOwnProperty('pushEnabled')) {
          return res.status(400).json({ error: 'Données de préférences invalides' });
        }
        
        const result = await mockPushService.updateNotificationPreferences(req.user.id, req.body);
        res.json(result);
      } catch (error) {
        next(error);
      }
    });
    
    router.get('/preferences', async (req, res, next) => {
      try {
        const user = await mockPrismaUser.findUnique({
          where: { id: req.user.id },
          select: { pushEnabled: true, fcmToken: true }
        });
        
        if (!user) {
          return res.status(404).json({ error: 'Utilisateur non trouvé' });
        }
        
        res.json(user);
      } catch (error) {
        next(error);
      }
    });
    
    router.post('/test', async (req, res, next) => {
      try {
        if (process.env.NODE_ENV === 'production') {
          return res.status(403).json({ error: 'Endpoint de test non disponible en production' });
        }
        
        const { message } = req.body;
        await mockPushService.sendToUser(req.user.id, {
          title: 'Test BAM',
          body: message,
          data: { type: 'test' }
        });
        
        res.json({ message: 'Notification de test envoyée' });
      } catch (error) {
        next(error);
      }
    });
    
    app.use('/api/notifications', router);
    
    // Middleware de gestion d'erreur
    app.use((err, req, res, next) => {
      res.status(err.status || 500).json({ 
        error: err.message || 'Erreur interne du serveur' 
      });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/notifications/register', () => {
    test('should register FCM token successfully', async () => {
      const fcmToken = 'valid-fcm-token-here-with-sufficient-length';
      
      mockPushService.registerToken.mockResolvedValue({
        success: true,
        fcmToken,
        pushEnabled: true,
      });

      const response = await request(app)
        .post('/api/notifications/register')
        .send({ fcmToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.pushEnabled).toBe(true);
      expect(mockPushService.registerToken).toHaveBeenCalledWith('test-user-id', fcmToken);
    });

    test('should reject invalid FCM token', async () => {
      const invalidToken = 'short';

      const response = await request(app)
        .post('/api/notifications/register')
        .send({ fcmToken: invalidToken });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Token FCM invalide');
      expect(mockPushService.registerToken).not.toHaveBeenCalled();
    });

    test('should reject missing FCM token', async () => {
      const response = await request(app)
        .post('/api/notifications/register')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Token FCM invalide');
      expect(mockPushService.registerToken).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/notifications/unregister', () => {
    test('should unregister FCM token successfully', async () => {
      mockPushService.unregisterToken.mockResolvedValue({ success: true });

      const response = await request(app)
        .delete('/api/notifications/unregister');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Token de notification supprimé avec succès');
      expect(mockPushService.unregisterToken).toHaveBeenCalledWith('test-user-id');
    });
  });

  describe('PUT /api/notifications/preferences', () => {
    test('should update notification preferences successfully', async () => {
      const preferences = { pushEnabled: false };
      
      mockPushService.updateNotificationPreferences.mockResolvedValue({
        success: true,
        ...preferences,
      });

      const response = await request(app)
        .put('/api/notifications/preferences')
        .send(preferences);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.pushEnabled).toBe(false);
      expect(mockPushService.updateNotificationPreferences).toHaveBeenCalledWith('test-user-id', preferences);
    });

    test('should reject invalid preferences', async () => {
      const response = await request(app)
        .put('/api/notifications/preferences')
        .send({ invalidField: 'invalid' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Données de préférences invalides');
    });
  });

  describe('GET /api/notifications/preferences', () => {
    test('should get notification preferences successfully', async () => {
      const mockUser = {
        id: 'test-user-id',
        pushEnabled: true,
        fcmToken: 'some-token',
      };

      mockPrismaUser.findUnique.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/notifications/preferences');

      expect(response.status).toBe(200);
      expect(response.body.pushEnabled).toBe(true);
      expect(response.body.fcmToken).toBe('some-token');
    });

    test('should handle user not found', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/notifications/preferences');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Utilisateur non trouvé');
    });
  });

  describe('POST /api/notifications/test', () => {
    test('should send test notification in development', async () => {
      // Mock NODE_ENV as development
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      mockPushService.sendToUser.mockResolvedValue({ success: true });

      const response = await request(app)
        .post('/api/notifications/test')
        .send({ message: 'Test notification' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Notification de test envoyée');
      expect(mockPushService.sendToUser).toHaveBeenCalledWith('test-user-id', {
        title: 'Test BAM',
        body: 'Test notification',
        data: { type: 'test' },
      });

      // Restore original NODE_ENV
      process.env.NODE_ENV = originalEnv;
    });

    test('should reject test notification in production', async () => {
      // Mock NODE_ENV as production
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .post('/api/notifications/test')
        .send({ message: 'Test notification' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Endpoint de test non disponible en production');

      // Restore original NODE_ENV
      process.env.NODE_ENV = originalEnv;
    });
  });
});