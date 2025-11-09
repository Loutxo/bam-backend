const request = require('supertest');
const express = require('express');

// Mock simplifié du service de signalement
const mockReportingService = {
  reportUser: jest.fn(),
  reportBam: jest.fn(),
  reportMessage: jest.fn(),
  getUserReports: jest.fn(),
  getReportById: jest.fn(),
  getUserActiveSanctions: jest.fn(),
  isUserBanned: jest.fn(),
  getReportsForModeration: jest.fn(),
  processReport: jest.fn(),
  getModerationStats: jest.fn(),
  issueSanction: jest.fn()
};

// Mock du module reportingService
jest.mock('../services/reportingService', () => {
  return jest.fn().mockImplementation(() => mockReportingService);
});

// Mock du middleware d'authentification
jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 'test-user-id', role: 'admin' };
    next();
  }
}));

const reportingRoutes = require('../routes/reporting');

describe('Reporting Routes - Basic Tests', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Middleware d'authentification simulé
    app.use((req, res, next) => {
      req.user = { id: 'test-user-id', role: 'admin' };
      next();
    });

    app.use('/reports', reportingRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Configuration par défaut des mocks
    mockReportingService.reportUser.mockResolvedValue({
      id: 'report-id',
      type: 'USER',
      category: 'HARASSMENT',
      reporterId: 'test-user-id',
      targetUserId: 'different-user-id',
      reason: 'Test reason',
      status: 'PENDING'
    });

    mockReportingService.getUserReports.mockResolvedValue({
      reports: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
    });

    mockReportingService.getReportsForModeration.mockResolvedValue({
      reports: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
    });

    mockReportingService.getModerationStats.mockResolvedValue({
      totalReports: 0,
      pendingReports: 0,
      resolvedReports: 0,
      reportsByCategory: {}
    });
  });

  describe('POST /reports/user', () => {
    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/reports/user')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Données invalides');
    });

    test('should validate UUID format', async () => {
      const response = await request(app)
        .post('/reports/user')
        .send({
          targetUserId: 'invalid-uuid',
          category: 'HARASSMENT',
          reason: 'Valid reason with enough characters'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should validate category values', async () => {
      const response = await request(app)
        .post('/reports/user')
        .send({
          targetUserId: '123e4567-e89b-12d3-a456-426614174000',
          category: 'INVALID_CATEGORY',
          reason: 'Valid reason with enough characters'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /reports/my', () => {
    test('should return user reports', async () => {
      const response = await request(app)
        .get('/reports/my')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockReportingService.getUserReports).toHaveBeenCalledWith('test-user-id', 1, 20);
    });

    test('should handle pagination parameters', async () => {
      const response = await request(app)
        .get('/reports/my?page=2&limit=10')
        .expect(200);

      expect(mockReportingService.getUserReports).toHaveBeenCalledWith('test-user-id', 2, 10);
    });
  });

  describe('GET /reports/sanctions/my', () => {
    test('should return user sanctions', async () => {
      mockReportingService.getUserActiveSanctions.mockResolvedValue([]);
      mockReportingService.isUserBanned.mockResolvedValue(false);

      const response = await request(app)
        .get('/reports/sanctions/my')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockReportingService.getUserActiveSanctions).toHaveBeenCalledWith('test-user-id');
      expect(mockReportingService.isUserBanned).toHaveBeenCalledWith('test-user-id');
    });
  });

  describe('GET /reports/moderation', () => {
    test('should return reports for moderation', async () => {
      const response = await request(app)
        .get('/reports/moderation')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockReportingService.getReportsForModeration).toHaveBeenCalled();
    });
  });

  describe('GET /reports/stats', () => {
    test('should return moderation statistics', async () => {
      const response = await request(app)
        .get('/reports/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(mockReportingService.getModerationStats).toHaveBeenCalled();
    });
  });

  describe('POST /reports/sanctions/manual', () => {
    test('should validate sanction types', async () => {
      const response = await request(app)
        .post('/reports/sanctions/manual')
        .send({
          targetUserId: '123e4567-e89b-12d3-a456-426614174000',
          type: 'INVALID_TYPE',
          reason: 'Valid reason'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should require duration for temporary ban', async () => {
      const response = await request(app)
        .post('/reports/sanctions/manual')
        .send({
          targetUserId: '123e4567-e89b-12d3-a456-426614174000',
          type: 'temp_ban',
          reason: 'Valid reason'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('durée');
    });
  });
});