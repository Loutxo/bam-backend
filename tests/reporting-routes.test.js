const request = require('supertest');
const express = require('express');

// Mock du service de signalement
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
  issueSanction: jest.fn(),
  issueWarning: jest.fn(),
  issueTempBan: jest.fn(),
  issuePermanentBan: jest.fn(),
  issueChatRestriction: jest.fn(),
  prisma: {
    report: {
      findUnique: jest.fn()
    }
  }
};

// Mock du module reportingService
jest.mock('../services/reportingService', () => {
  return jest.fn().mockImplementation(() => mockReportingService);
});

// Mock du middleware d'authentification
jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 'test-user-id', pseudo: 'testuser' };
    next();
  }
}));

const reportingRoutes = require('../routes/reporting');

describe('Reporting Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    
    app = express();
    app.use(express.json());
    
    // Middleware d'authentification simulé
    app.use((req, res, next) => {
      req.user = { id: 'test-user-id', role: 'admin' };
      next();
    });

    // Middleware admin simulé pour routes spécifiques
    app.use((req, res, next) => {
      if (req.path.includes('/moderation') || req.path.includes('/stats')) {
        req.isAdmin = true;
      }
      next();
    });

    app.use('/reports', reportingRoutes);

    // Valeurs par défaut pour les mocks
    mockReportingService.reportUser.mockResolvedValue({
      id: 'report-id',
      type: 'USER',
      category: 'HARASSMENT',
      reporterId: 'test-user-id',
      targetUserId: 'target-user-id',
      reason: 'Test reason',
      status: 'PENDING'
    });

    mockReportingService.reportBam.mockResolvedValue({
      id: 'report-id',
      type: 'BAM',
      category: 'SPAM',
      reporterId: 'test-user-id',
      bamId: 'target-bam-id',
      reason: 'Test reason',
      status: 'PENDING'
    });

    mockReportingService.reportMessage.mockResolvedValue({
      id: 'report-id',
      type: 'MESSAGE',
      category: 'INAPPROPRIATE',
      reporterId: 'test-user-id',
      messageId: 'target-message-id',
      reason: 'Test reason',
      status: 'PENDING'
    });

    mockReportingService.getUserReports.mockResolvedValue({
      reports: [{
        id: 'report-1',
        category: 'SPAM',
        status: 'PENDING',
        createdAt: '2025-10-23T19:47:28.784Z'
      }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 }
    });

    mockReportingService.getReportById.mockResolvedValue({
      id: 'test-report-id',
      reporterId: 'test-user-id',
      category: 'SPAM',
      status: 'PENDING',
      createdAt: new Date()
    });

    mockReportingService.getReportsForModeration.mockResolvedValue({
      reports: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }
    });

    mockReportingService.getModerationStats.mockResolvedValue({
      totalReports: 10,
      pendingReports: 5,
      resolvedReports: 5,
      reportsByCategory: {}
    });

    mockReportingService.processReport.mockResolvedValue({
      id: 'test-report-id',
      status: 'RESOLVED'
    });

    mockReportingService.issueSanction.mockResolvedValue({
      id: 'sanction-id',
      type: 'warning'
    });

    mockReportingService.getUserActiveSanctions.mockResolvedValue([]);
    mockReportingService.isUserBanned.mockResolvedValue(false);
  });

  describe('POST /reports/user', () => {
    test('should create user report successfully', async () => {
      // Configuration spécifique du mock pour ce test
      mockReportingService.reportUser.mockResolvedValueOnce({
        id: 'report-id',
        type: 'USER',
        category: 'HARASSMENT',
        reporterId: 'test-user-id',
        targetUserId: 'different-user-id',
        reason: 'Comportement inapproprié',
        status: 'PENDING'
      });

      const reportData = {
        targetUserId: 'different-user-id',
        category: 'HARASSMENT',
        reason: 'Comportement inapproprié',
        description: 'Description détaillée'
      };

      const response = await request(app)
        .post('/reports/user')
        .send(reportData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('créé avec succès');
      expect(mockReportingService.reportUser).toHaveBeenCalledWith(
        'test-user-id',
        'different-user-id',
        'HARASSMENT',
        'Comportement inapproprié',
        'Description détaillée',
        undefined
      );
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/reports/user')
        .send({
          category: 'HARASSMENT'
          // Missing targetUserId and reason
        })
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
          reason: 'Test reason with enough characters'
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
          reason: 'Test reason with enough characters'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should handle service errors', async () => {
      mockReportingService.reportUser.mockRejectedValue(new Error('Impossible de se signaler soi-même'));

      const response = await request(app)
        .post('/reports/user')
        .send({
          targetUserId: '123e4567-e89b-12d3-a456-426614174000',
          category: 'HARASSMENT',
          reason: 'Test reason with enough characters'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Impossible de se signaler soi-même');
    });
  });

  describe('POST /reports/bam', () => {
    test('should create BAM report successfully', async () => {
      mockReportingService.reportBam.mockResolvedValue({
        id: 'report-id',
        type: 'BAM',
        category: 'INAPPROPRIATE'
      });

      const response = await request(app)
        .post('/reports/bam')
        .send({
          targetBamId: '123e4567-e89b-12d3-a456-426614174000',
          category: 'INAPPROPRIATE',
          reason: 'Contenu inapproprié signalé'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(mockReportingService.reportBam).toHaveBeenCalled();
    });
  });

  describe('POST /reports/message', () => {
    test('should create message report successfully', async () => {
      mockReportingService.reportMessage.mockResolvedValue({
        id: 'report-id',
        type: 'MESSAGE',
        category: 'HARASSMENT'
      });

      const response = await request(app)
        .post('/reports/message')
        .send({
          targetMessageId: '123e4567-e89b-12d3-a456-426614174000',
          category: 'HARASSMENT',
          reason: 'Message de harcèlement signalé'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(mockReportingService.reportMessage).toHaveBeenCalled();
    });
  });

  describe('GET /reports/my', () => {
    test('should return user reports', async () => {
      const mockReports = {
        reports: [
          {
            id: 'report-1',
            category: 'SPAM',
            status: 'PENDING',
            createdAt: new Date()
          }
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1
        }
      };

      mockReportingService.getUserReports.mockResolvedValue(mockReports);

      const response = await request(app)
        .get('/reports/my')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reports).toHaveLength(1);
      expect(response.body.data.reports[0].id).toBe('report-1');
      expect(response.body.data.reports[0].category).toBe('SPAM');
      expect(response.body.data.reports[0].status).toBe('PENDING');
      expect(response.body.data.pagination.total).toBe(1);
      expect(mockReportingService.getUserReports).toHaveBeenCalledWith('test-user-id', 1, 20);
    });

    test('should handle pagination parameters', async () => {
      const response = await request(app)
        .get('/reports/my?page=2&limit=10')
        .expect(200);

      expect(mockReportingService.getUserReports).toHaveBeenCalledWith('test-user-id', 2, 10);
    });
  });

  describe('GET /reports/:id', () => {
    test('should return specific report', async () => {
      const mockReport = {
        id: 'report-id',
        reporterId: 'test-user-id',
        category: 'SPAM',
        status: 'PENDING'
      };

      mockReportingService.prisma.report.findUnique.mockResolvedValue(mockReport);

      const response = await request(app)
        .get('/reports/123e4567-e89b-12d3-a456-426614174000')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockReport);
    });

    test('should return 404 for non-existent report', async () => {
      mockReportingService.prisma.report.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/reports/123e4567-e89b-12d3-a456-426614174000')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Signalement introuvable');
    });

    test('should return 403 for unauthorized access', async () => {
      const mockReport = {
        id: 'report-id',
        reporterId: 'other-user-id', // Different from test-user-id
        category: 'SPAM'
      };

      mockReportingService.prisma.report.findUnique.mockResolvedValue(mockReport);

      const response = await request(app)
        .get('/reports/123e4567-e89b-12d3-a456-426614174000')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Accès non autorisé à ce signalement');
    });
  });

  describe('GET /reports/sanctions/my', () => {
    test('should return user sanctions', async () => {
      const mockSanctions = [
        {
          id: 'sanction-1',
          type: 'WARNING',
          reason: 'Test warning',
          isActive: true
        }
      ];

      mockReportingService.getUserActiveSanctions.mockResolvedValue(mockSanctions);

      const response = await request(app)
        .get('/reports/sanctions/my')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.activeSanctions).toEqual(mockSanctions);
      expect(response.body.data.isBanned).toBe(false);
    });

    test('should indicate if user is banned', async () => {
      const mockSanctions = [
        {
          id: 'sanction-1',
          type: 'TEMPORARY_BAN',
          reason: 'Test ban',
          isActive: true
        }
      ];

      mockReportingService.getUserActiveSanctions.mockResolvedValue(mockSanctions);

      const response = await request(app)
        .get('/reports/sanctions/my')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isBanned).toBe(true);
    });
  });

  describe('GET /reports/moderation', () => {
    test('should return reports for moderation', async () => {
      const mockModerationData = {
        reports: [
          {
            id: 'report-1',
            category: 'SPAM',
            status: 'PENDING'
          }
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1
        }
      };

      mockReportingService.getReportsForModeration.mockResolvedValue(mockModerationData);

      const response = await request(app)
        .get('/reports/moderation')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockModerationData);
    });

    test('should handle filtering parameters', async () => {
      const response = await request(app)
        .get('/reports/moderation?status=PENDING&category=SPAM&type=USER')
        .expect(200);

      expect(mockReportingService.getReportsForModeration).toHaveBeenCalledWith(
        {
          status: 'PENDING',
          category: 'SPAM',
          type: 'USER',
          dateFrom: undefined
        },
        1,
        20
      );
    });
  });

  describe('PUT /reports/:id/process', () => {
    test('should process report successfully', async () => {
      const mockProcessedReport = {
        id: 'report-id',
        status: 'RESOLVED',
        actionTaken: 'WARNING'
      };

      mockReportingService.processReport.mockResolvedValue(mockProcessedReport);

      const response = await request(app)
        .put('/reports/123e4567-e89b-12d3-a456-426614174000/process')
        .send({
          status: 'RESOLVED',
          actionTaken: 'WARNING',
          adminNotes: 'Test notes'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockProcessedReport);
      expect(mockReportingService.processReport).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
        'test-user-id',
        'RESOLVED',
        'WARNING',
        'Test notes'
      );
    });

    test('should validate processing parameters', async () => {
      const response = await request(app)
        .put('/reports/123e4567-e89b-12d3-a456-426614174000/process')
        .send({
          status: 'INVALID_STATUS'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /reports/stats', () => {
    test('should return moderation statistics', async () => {
      const mockStats = {
        reports: {
          total: 100,
          pending: 20,
          resolved: 60,
          dismissed: 20,
          resolutionRate: '80.0'
        },
        sanctions: {
          active: 5,
          total: 25
        }
      };

      mockReportingService.getModerationStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/reports/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
    });
  });

  describe('POST /reports/sanctions/manual', () => {
    test('should issue warning successfully', async () => {
      const mockSanction = {
        id: 'sanction-id',
        type: 'WARNING',
        reason: 'Manual warning'
      };

      mockReportingService.issueWarning.mockResolvedValue(mockSanction);

      const response = await request(app)
        .post('/reports/sanctions/manual')
        .send({
          userId: '123e4567-e89b-12d3-a456-426614174000',
          type: 'WARNING',
          reason: 'Manual warning issued by admin'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSanction);
      expect(mockReportingService.issueWarning).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
        'Manual warning issued by admin',
        'test-user-id'
      );
    });

    test('should issue temporary ban with duration', async () => {
      const mockSanction = {
        id: 'sanction-id',
        type: 'TEMPORARY_BAN',
        duration: 24
      };

      mockReportingService.issueTempBan.mockResolvedValue(mockSanction);

      const response = await request(app)
        .post('/reports/sanctions/manual')
        .send({
          userId: '123e4567-e89b-12d3-a456-426614174000',
          type: 'TEMPORARY_BAN',
          reason: 'Temporary ban for violations',
          duration: 24
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(mockReportingService.issueTempBan).toHaveBeenCalledWith(
        '123e4567-e89b-12d3-a456-426614174000',
        24,
        'Temporary ban for violations',
        'test-user-id'
      );
    });

    test('should require duration for temporary ban', async () => {
      const response = await request(app)
        .post('/reports/sanctions/manual')
        .send({
          userId: '123e4567-e89b-12d3-a456-426614174000',
          type: 'TEMPORARY_BAN',
          reason: 'Temporary ban without duration'
          // Missing duration
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Durée requise pour un ban temporaire');
    });

    test('should validate sanction types', async () => {
      const response = await request(app)
        .post('/reports/sanctions/manual')
        .send({
          userId: '123e4567-e89b-12d3-a456-426614174000',
          type: 'INVALID_TYPE',
          reason: 'Test reason with enough characters'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});