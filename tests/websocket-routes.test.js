const request = require('supertest');
const express = require('express');

// Mock auth middleware
jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 'test-user-id', pseudo: 'testuser' };
    next();
  },
}));

// Mock ApiError
jest.mock('../middleware/errorHandler', () => ({
  ApiError: class ApiError extends Error {
    constructor(status, message, details) {
      super(message);
      this.status = status;
      this.details = details;
    }
  },
}));

// Mock WebSocket Service
const mockWebSocketService = {
  getStats: jest.fn(),
  isUserOnline: jest.fn(),
  getOnlineUsersInBam: jest.fn(),
  emitToUser: jest.fn(),
  io: {
    emit: jest.fn()
  }
};

describe('WebSocket API Routes', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Set mock WebSocket service
    app.set('webSocketService', mockWebSocketService);
    
    // Import routes
    const websocketRoutes = require('../routes/websocket');
    app.use('/websocket', websocketRoutes);
    
    // Error handler
    app.use((err, req, res, next) => {
      res.status(err.status || 500).json({ 
        error: err.message || 'Erreur interne du serveur' 
      });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /websocket/stats', () => {
    test('should return WebSocket statistics', async () => {
      const mockStats = {
        connectedUsers: 5,
        activeBams: 3,
        totalSockets: 5
      };

      mockWebSocketService.getStats.mockReturnValue(mockStats);

      const response = await request(app)
        .get('/websocket/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.stats).toEqual(mockStats);
      expect(mockWebSocketService.getStats).toHaveBeenCalled();
    });

    test('should handle missing WebSocket service', async () => {
      // Create app without WebSocket service
      const testApp = express();
      testApp.use(express.json());
      
      const websocketRoutes = require('../routes/websocket');
      testApp.use('/websocket', websocketRoutes);
      
      testApp.use((err, req, res, next) => {
        res.status(err.status || 500).json({ error: err.message });
      });

      const response = await request(testApp)
        .get('/websocket/stats');

      expect(response.status).toBe(503);
      expect(response.body.error).toBe('Service WebSocket non disponible');
    });
  });

  describe('GET /websocket/presence/:userId', () => {
    test('should check user presence', async () => {
      const userId = 'target-user-id';
      mockWebSocketService.isUserOnline.mockReturnValue(true);

      const response = await request(app)
        .get(`/websocket/presence/${userId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.userId).toBe(userId);
      expect(response.body.isOnline).toBe(true);
      expect(response.body.timestamp).toBeDefined();
      expect(mockWebSocketService.isUserOnline).toHaveBeenCalledWith(userId);
    });

    test('should return false for offline user', async () => {
      const userId = 'offline-user-id';
      mockWebSocketService.isUserOnline.mockReturnValue(false);

      const response = await request(app)
        .get(`/websocket/presence/${userId}`);

      expect(response.status).toBe(200);
      expect(response.body.isOnline).toBe(false);
    });
  });

  describe('GET /websocket/bam/:bamId/online', () => {
    test('should return online users in BAM', async () => {
      const bamId = 'test-bam-id';
      const onlineUsers = ['user1', 'user2', 'user3'];
      
      mockWebSocketService.getOnlineUsersInBam.mockReturnValue(onlineUsers);

      const response = await request(app)
        .get(`/websocket/bam/${bamId}/online`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.bamId).toBe(bamId);
      expect(response.body.onlineUsers).toEqual(onlineUsers);
      expect(response.body.count).toBe(3);
      expect(mockWebSocketService.getOnlineUsersInBam).toHaveBeenCalledWith(bamId);
    });

    test('should return empty array for BAM with no online users', async () => {
      const bamId = 'empty-bam-id';
      mockWebSocketService.getOnlineUsersInBam.mockReturnValue([]);

      const response = await request(app)
        .get(`/websocket/bam/${bamId}/online`);

      expect(response.status).toBe(200);
      expect(response.body.count).toBe(0);
      expect(response.body.onlineUsers).toEqual([]);
    });
  });

  describe('POST /websocket/notify', () => {
    test('should send notification to specific user', async () => {
      const targetUserId = 'target-user';
      const event = 'custom-notification';
      const data = { message: 'Hello!', type: 'info' };

      mockWebSocketService.emitToUser.mockReturnValue(true);

      const response = await request(app)
        .post('/websocket/notify')
        .send({ targetUserId, event, data });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.sent).toBe(true);
      expect(response.body.targetUserId).toBe(targetUserId);
      expect(response.body.event).toBe(event);
      expect(mockWebSocketService.emitToUser).toHaveBeenCalledWith(
        targetUserId,
        event,
        expect.objectContaining({
          ...data,
          timestamp: expect.any(String),
          from: 'system'
        })
      );
    });

    test('should handle user not connected', async () => {
      const targetUserId = 'offline-user';
      const event = 'test-event';

      mockWebSocketService.emitToUser.mockReturnValue(false);

      const response = await request(app)
        .post('/websocket/notify')
        .send({ targetUserId, event });

      expect(response.status).toBe(200);
      expect(response.body.sent).toBe(false);
      expect(response.body.message).toBe('Utilisateur non connecté');
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/websocket/notify')
        .send({ data: { message: 'test' } });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('targetUserId et event sont requis');
    });
  });

  describe('POST /websocket/broadcast', () => {
    test('should broadcast message to all connected users', async () => {
      const event = 'system-announcement';
      const data = { message: 'Maintenance scheduled', urgent: true };

      mockWebSocketService.getStats.mockReturnValue({ connectedUsers: 10 });

      const response = await request(app)
        .post('/websocket/broadcast')
        .send({ event, data });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.event).toBe(event);
      expect(response.body.broadcastTo).toBe(10);
      expect(mockWebSocketService.io.emit).toHaveBeenCalledWith(
        event,
        expect.objectContaining({
          ...data,
          timestamp: expect.any(String),
          from: 'admin'
        })
      );
    });

    test('should validate event field', async () => {
      const response = await request(app)
        .post('/websocket/broadcast')
        .send({ data: { message: 'test' } });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('event est requis');
    });
  });
});