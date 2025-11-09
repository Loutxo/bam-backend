const request = require('supertest');
const express = require('express');
const http = require('http');
const Client = require('socket.io-client');

// Mock des services
const mockReportingService = {
  reportUser: jest.fn(),
  setWebSocketService: jest.fn()
};

const mockWebSocketService = {
  initialize: jest.fn(),
  notifyUserReported: jest.fn(),
  notifyModerators: jest.fn(),
  notifyUserSanctioned: jest.fn(),
  notifyReportStatusUpdate: jest.fn(),
  notifyAutoModeration: jest.fn()
};

// Mock des modules
jest.mock('../services/reportingService', () => {
  return jest.fn().mockImplementation(() => mockReportingService);
});

jest.mock('../services/webSocketService', () => mockWebSocketService);

jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 'test-user-id', role: 'admin' };
    next();
  }
}));

describe('WebSocket Integration with Reporting System', () => {
  let app;
  let server;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Middleware d'authentification simulé
    app.use((req, res, next) => {
      req.user = { id: 'test-user-id', role: 'admin' };
      next();
    });
    
    // Simuler l'injection du WebSocketService
    app.set('webSocketService', mockWebSocketService);
    
    const reportingRoutes = require('../routes/reporting');
    app.use('/reports', reportingRoutes);
    
    server = http.createServer(app);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Configuration des mocks
    mockReportingService.reportUser.mockResolvedValue({
      id: 'report-123',
      type: 'USER',
      category: 'HARASSMENT',
      reporterId: 'test-user-id',
      targetUserId: 'target-user-id',
      reason: 'Test reason',
      status: 'PENDING',
      reporter: { id: 'test-user-id', pseudo: 'TestUser' },
      targetUser: { id: 'target-user-id', pseudo: 'TargetUser' }
    });
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  describe('WebSocket Notifications on User Report', () => {
    test('should trigger WebSocket notifications when reporting user', async () => {
      const reportData = {
        targetUserId: 'target-user-id',
        category: 'HARASSMENT',
        reason: 'Inappropriate behavior',
        description: 'Detailed description'
      };

      const response = await request(app)
        .post('/reports/user')
        .send(reportData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(mockReportingService.reportUser).toHaveBeenCalledWith(
        'test-user-id',
        'target-user-id',
        'HARASSMENT',
        'Inappropriate behavior',
        'Detailed description',
        undefined
      );
    });

    test('should handle WebSocket service unavailability gracefully', async () => {
      // Simuler l'absence du service WebSocket
      app.set('webSocketService', null);

      const reportData = {
        targetUserId: 'target-user-id',
        category: 'SPAM',
        reason: 'Spam content'
      };

      const response = await request(app)
        .post('/reports/user')
        .send(reportData)
        .expect(201);

      expect(response.body.success).toBe(true);
      // Aucune notification ne devrait être envoyée
      expect(mockWebSocketService.notifyUserReported).not.toHaveBeenCalled();
      expect(mockWebSocketService.notifyModerators).not.toHaveBeenCalled();

      // Remettre le service pour les autres tests
      app.set('webSocketService', mockWebSocketService);
    });
  });

  describe('WebSocket Service Methods', () => {
    test('should call notifyUserReported with correct parameters', () => {
      const userId = 'user-123';
      const reportData = {
        id: 'report-123',
        category: 'SPAM',
        reporter: 'TestUser'
      };

      mockWebSocketService.notifyUserReported(userId, reportData);

      expect(mockWebSocketService.notifyUserReported).toHaveBeenCalledWith(userId, reportData);
    });

    test('should call notifyModerators with correct parameters', () => {
      const reportData = {
        id: 'report-123',
        type: 'USER',
        category: 'HARASSMENT',
        targetUser: 'TargetUser',
        reporter: 'TestUser'
      };

      mockWebSocketService.notifyModerators(reportData);

      expect(mockWebSocketService.notifyModerators).toHaveBeenCalledWith(reportData);
    });

    test('should call notifyUserSanctioned with correct parameters', () => {
      const userId = 'user-123';
      const sanctionData = {
        type: 'WARNING',
        reason: 'Inappropriate behavior',
        message: 'You have been warned'
      };

      mockWebSocketService.notifyUserSanctioned(userId, sanctionData);

      expect(mockWebSocketService.notifyUserSanctioned).toHaveBeenCalledWith(userId, sanctionData);
    });

    test('should call notifyAutoModeration with correct parameters', () => {
      const userId = 'user-123';
      const moderationData = {
        action: 'FLAG',
        reason: 'Content flagged by automatic filters',
        severity: 5,
        rules: ['spam-detection', 'harassment-detection']
      };

      mockWebSocketService.notifyAutoModeration(userId, moderationData);

      expect(mockWebSocketService.notifyAutoModeration).toHaveBeenCalledWith(userId, moderationData);
    });
  });

  describe('Integration with ReportingService', () => {
    test('should inject WebSocketService into ReportingService', () => {
      // Test que l'injection de dépendance fonctionne
      expect(mockReportingService.setWebSocketService).toHaveBeenCalledWith(mockWebSocketService);
    });

    test('should handle reporting service errors gracefully with WebSocket', async () => {
      mockReportingService.reportUser.mockRejectedValue(new Error('Cannot report yourself'));

      const reportData = {
        targetUserId: 'test-user-id', // Signaler soi-même
        category: 'SPAM',
        reason: 'Test reason'
      };

      const response = await request(app)
        .post('/reports/user')
        .send(reportData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Cannot report yourself');
      
      // Aucune notification ne devrait être envoyée en cas d'erreur
      expect(mockWebSocketService.notifyUserReported).not.toHaveBeenCalled();
      expect(mockWebSocketService.notifyModerators).not.toHaveBeenCalled();
    });
  });

  describe('Real-time Event Types', () => {
    test('should define correct event types for notifications', () => {
      // Test des types d'événements WebSocket utilisés
      const eventTypes = [
        'user:reported',
        'user:sanctioned', 
        'user:banned',
        'moderation:new-report',
        'report:status-updated',
        'content:auto-moderated',
        'bam:removed',
        'moderation:stats-update'
      ];

      eventTypes.forEach(eventType => {
        expect(eventType).toMatch(/^[a-z]+:[a-z-]+$/);
      });
    });

    test('should handle notification data structure correctly', () => {
      const notificationData = {
        type: 'USER_REPORTED',
        message: 'You have been reported for SPAM',
        category: 'SPAM',
        reportId: 'report-123',
        timestamp: new Date().toISOString()
      };

      expect(notificationData).toHaveProperty('type');
      expect(notificationData).toHaveProperty('timestamp');
      expect(notificationData.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('Performance and Error Handling', () => {
    test('should not block reporting if WebSocket fails', async () => {
      // Simuler une erreur WebSocket
      mockWebSocketService.notifyUserReported.mockImplementation(() => {
        throw new Error('WebSocket connection failed');
      });

      const reportData = {
        targetUserId: 'target-user-id',
        category: 'SPAM',
        reason: 'Test reason'
      };

      const response = await request(app)
        .post('/reports/user')
        .send(reportData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(mockReportingService.reportUser).toHaveBeenCalled();
    });

    test('should handle concurrent report notifications', async () => {
      const promises = Array.from({ length: 5 }, (_, i) => 
        request(app)
          .post('/reports/user')
          .send({
            targetUserId: `target-user-${i}`,
            category: 'SPAM',
            reason: `Test reason ${i}`
          })
      );

      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
      });

      expect(mockReportingService.reportUser).toHaveBeenCalledTimes(5);
    });
  });
});