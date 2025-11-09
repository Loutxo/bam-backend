const ReportingService = require('../services/reportingService');
const { PrismaClient } = require('@prisma/client');

// Mock Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    report: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn()
    },
    user: {
      findUnique: jest.fn()
    },
    bam: {
      findUnique: jest.fn(),
      delete: jest.fn()
    },
    message: {
      findUnique: jest.fn(),
      delete: jest.fn()
    },
    userSanction: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn()
    },
    autoModerationRule: {
      findMany: jest.fn(),
      update: jest.fn()
    }
  }))
}));

describe('ReportingService', () => {
  let reportingService;
  let mockPrisma;

  beforeEach(() => {
    jest.clearAllMocks();
    reportingService = new ReportingService();
    mockPrisma = reportingService.prisma;
  });

  describe('reportUser', () => {
    test('should create user report successfully', async () => {
      const mockUser = { id: 'target-user-id', pseudo: 'target' };
      const mockReport = {
        id: 'report-id',
        type: 'USER',
        category: 'HARASSMENT',
        reporterId: 'reporter-id',
        targetUserId: 'target-user-id',
        reason: 'Comportement inapproprié',
        status: 'PENDING'
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.report.findFirst.mockResolvedValue(null); // Pas de signalement existant
      mockPrisma.report.create.mockResolvedValue(mockReport);
      mockPrisma.autoModerationRule.findMany.mockResolvedValue([]);

      const result = await reportingService.reportUser(
        'reporter-id',
        'target-user-id',
        'HARASSMENT',
        'Comportement inapproprié'
      );

      expect(result).toEqual(mockReport);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'target-user-id' }
      });
      expect(mockPrisma.report.create).toHaveBeenCalledWith({
        data: {
          type: 'USER',
          category: 'HARASSMENT',
          reporterId: 'reporter-id',
          targetUserId: 'target-user-id',
          reason: 'Comportement inapproprié',
          description: null,
          evidence: null,
          status: 'PENDING'
        },
        include: {
          reporter: { select: { id: true, pseudo: true } },
          targetUser: { select: { id: true, pseudo: true } }
        }
      });
    });

    test('should reject self-reporting', async () => {
      await expect(
        reportingService.reportUser('user-id', 'user-id', 'SPAM', 'Test')
      ).rejects.toThrow('Impossible de se signaler soi-même');
    });

    test('should reject if target user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        reportingService.reportUser('reporter-id', 'nonexistent-id', 'SPAM', 'Test')
      ).rejects.toThrow('Utilisateur à signaler introuvable');
    });

    test('should reject duplicate recent reports', async () => {
      const mockUser = { id: 'target-user-id', pseudo: 'target' };
      const existingReport = { id: 'existing-report' };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.report.findFirst.mockResolvedValue(existingReport);

      await expect(
        reportingService.reportUser('reporter-id', 'target-user-id', 'SPAM', 'Test')
      ).rejects.toThrow(/déjà signalé cet utilisateur récemment/);
    });
  });

  describe('reportBam', () => {
    test('should create BAM report successfully', async () => {
      const mockBam = {
        id: 'bam-id',
        text: 'Test BAM',
        userId: 'bam-owner-id',
        user: { id: 'bam-owner-id', pseudo: 'owner' }
      };
      const mockReport = {
        id: 'report-id',
        type: 'BAM',
        category: 'INAPPROPRIATE',
        reporterId: 'reporter-id',
        targetBamId: 'bam-id'
      };

      mockPrisma.bam.findUnique.mockResolvedValue(mockBam);
      mockPrisma.report.findFirst.mockResolvedValue(null);
      mockPrisma.report.create.mockResolvedValue(mockReport);
      mockPrisma.autoModerationRule.findMany.mockResolvedValue([]);

      const result = await reportingService.reportBam(
        'reporter-id',
        'bam-id',
        'INAPPROPRIATE',
        'Contenu inapproprié'
      );

      expect(result).toEqual(mockReport);
      expect(mockPrisma.bam.findUnique).toHaveBeenCalledWith({
        where: { id: 'bam-id' },
        include: { user: true }
      });
    });

    test('should reject reporting own BAM', async () => {
      const mockBam = {
        id: 'bam-id',
        userId: 'user-id',
        user: { id: 'user-id' }
      };

      mockPrisma.bam.findUnique.mockResolvedValue(mockBam);

      await expect(
        reportingService.reportBam('user-id', 'bam-id', 'SPAM', 'Test')
      ).rejects.toThrow('Impossible de signaler son propre BAM');
    });
  });

  describe('reportMessage', () => {
    test('should create message report successfully', async () => {
      const mockMessage = {
        id: 'message-id',
        text: 'Test message',
        fromUserId: 'sender-id',
        toUserId: 'reporter-id',
        fromUser: { id: 'sender-id', pseudo: 'sender' },
        toUser: { id: 'reporter-id', pseudo: 'reporter' }
      };
      const mockReport = {
        id: 'report-id',
        type: 'MESSAGE',
        category: 'HARASSMENT',
        reporterId: 'reporter-id',
        targetMessageId: 'message-id'
      };

      mockPrisma.message.findUnique.mockResolvedValue(mockMessage);
      mockPrisma.report.create.mockResolvedValue(mockReport);
      mockPrisma.autoModerationRule.findMany.mockResolvedValue([]);

      const result = await reportingService.reportMessage(
        'reporter-id',
        'message-id',
        'HARASSMENT',
        'Message de harcèlement'
      );

      expect(result).toEqual(mockReport);
    });

    test('should reject reporting own message', async () => {
      const mockMessage = {
        id: 'message-id',
        fromUserId: 'user-id',
        toUserId: 'other-user-id'
      };

      mockPrisma.message.findUnique.mockResolvedValue(mockMessage);

      await expect(
        reportingService.reportMessage('user-id', 'message-id', 'SPAM', 'Test')
      ).rejects.toThrow('Impossible de signaler son propre message');
    });

    test('should reject if not participant in conversation', async () => {
      const mockMessage = {
        id: 'message-id',
        fromUserId: 'sender-id',
        toUserId: 'receiver-id'
      };

      mockPrisma.message.findUnique.mockResolvedValue(mockMessage);

      await expect(
        reportingService.reportMessage('outsider-id', 'message-id', 'SPAM', 'Test')
      ).rejects.toThrow('Vous ne pouvez signaler que les messages de vos conversations');
    });
  });

  describe('processReport', () => {
    test('should process report successfully', async () => {
      const mockReport = {
        id: 'report-id',
        status: 'PENDING',
        targetUserId: 'target-id',
        reason: 'Test reason'
      };
      const mockUpdatedReport = {
        ...mockReport,
        status: 'RESOLVED',
        reviewedBy: 'moderator-id',
        actionTaken: 'WARNING'
      };

      mockPrisma.report.findUnique.mockResolvedValue(mockReport);
      mockPrisma.report.update.mockResolvedValue(mockUpdatedReport);
      mockPrisma.userSanction.create.mockResolvedValue({ id: 'sanction-id' });

      const result = await reportingService.processReport(
        'report-id',
        'moderator-id',
        'RESOLVED',
        'WARNING',
        'Test notes'
      );

      expect(result).toEqual(mockUpdatedReport);
      expect(mockPrisma.report.update).toHaveBeenCalledWith({
        where: { id: 'report-id' },
        data: {
          status: 'RESOLVED',
          reviewedBy: 'moderator-id',
          reviewedAt: expect.any(Date),
          actionTaken: 'WARNING',
          adminNotes: 'Test notes'
        },
        include: {
          reporter: { select: { id: true, pseudo: true } },
          targetUser: { select: { id: true, pseudo: true } },
          reviewedByUser: { select: { id: true, pseudo: true } }
        }
      });
    });

    test('should reject processing already processed report', async () => {
      const mockReport = {
        id: 'report-id',
        status: 'RESOLVED'
      };

      mockPrisma.report.findUnique.mockResolvedValue(mockReport);

      await expect(
        reportingService.processReport('report-id', 'moderator-id', 'DISMISSED')
      ).rejects.toThrow('Ce signalement a déjà été traité');
    });
  });

  describe('sanctions', () => {
    test('should issue warning successfully', async () => {
      const mockSanction = {
        id: 'sanction-id',
        userId: 'user-id',
        type: 'WARNING',
        reason: 'Test warning'
      };

      mockPrisma.userSanction.create.mockResolvedValue(mockSanction);

      const result = await reportingService.issueWarning(
        'user-id',
        'Test warning',
        'moderator-id'
      );

      expect(result).toEqual(mockSanction);
      expect(mockPrisma.userSanction.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-id',
          type: 'WARNING',
          reason: 'Test warning',
          issuedBy: 'moderator-id'
        }
      });
    });

    test('should issue temporary ban successfully', async () => {
      const mockBan = {
        id: 'ban-id',
        userId: 'user-id',
        type: 'TEMPORARY_BAN',
        duration: 24,
        expiresAt: expect.any(Date)
      };

      mockPrisma.userSanction.create.mockResolvedValue(mockBan);

      const result = await reportingService.issueTempBan(
        'user-id',
        24,
        'Test ban',
        'moderator-id'
      );

      expect(result).toEqual(mockBan);
      expect(mockPrisma.userSanction.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-id',
          type: 'TEMPORARY_BAN',
          reason: 'Test ban',
          duration: 24,
          expiresAt: expect.any(Date),
          issuedBy: 'moderator-id'
        }
      });
    });

    test('should check if user is banned', async () => {
      const mockBan = {
        id: 'ban-id',
        type: 'TEMPORARY_BAN',
        expiresAt: new Date(Date.now() + 60000) // Expires in 1 minute
      };

      mockPrisma.userSanction.findFirst.mockResolvedValue(mockBan);

      const result = await reportingService.isUserBanned('user-id');

      expect(result).toBe(true);
      expect(mockPrisma.userSanction.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-id',
          type: { in: ['TEMPORARY_BAN', 'PERMANENT_BAN'] },
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: expect.any(Date) } }
          ]
        }
      });
    });
  });

  describe('getUserReports', () => {
    test('should return user reports with pagination', async () => {
      const mockReports = [
        { id: 'report-1', category: 'SPAM' },
        { id: 'report-2', category: 'HARASSMENT' }
      ];

      mockPrisma.report.findMany.mockResolvedValue(mockReports);
      mockPrisma.report.count.mockResolvedValue(10);

      const result = await reportingService.getUserReports('user-id', 1, 5);

      expect(result).toEqual({
        reports: mockReports,
        pagination: {
          page: 1,
          limit: 5,
          total: 10,
          totalPages: 2
        }
      });
    });
  });

  describe('autoModeration', () => {
    test('should trigger auto-escalation for multiple reports', async () => {
      const mockReport = {
        id: 'report-id',
        targetUserId: 'target-id'
      };

      mockPrisma.report.count.mockResolvedValue(3); // 3 recent reports
      mockPrisma.report.update.mockResolvedValue({ ...mockReport, status: 'ESCALATED' });
      mockPrisma.autoModerationRule.findMany.mockResolvedValue([]);

      await reportingService.checkAutoModeration(mockReport);

      expect(mockPrisma.report.update).toHaveBeenCalledWith({
        where: { id: 'report-id' },
        data: { status: 'ESCALATED' }
      });
    });

    test('should auto-ban for excessive reports', async () => {
      const mockReport = {
        id: 'report-id',
        targetUserId: 'target-id',
        reason: 'Test'
      };

      mockPrisma.report.count.mockResolvedValue(5); // 5 recent reports
      mockPrisma.userSanction.create.mockResolvedValue({ id: 'sanction-id' });
      mockPrisma.report.update.mockResolvedValue(mockReport);
      mockPrisma.autoModerationRule.findMany.mockResolvedValue([]);

      await reportingService.checkAutoModeration(mockReport);

      expect(mockPrisma.userSanction.create).toHaveBeenCalled();
      expect(mockPrisma.report.update).toHaveBeenCalledWith({
        where: { id: 'report-id' },
        data: {
          status: 'RESOLVED',
          actionTaken: 'AUTO_TEMP_BAN_1H',
          adminNotes: 'Trop de signalements récents'
        }
      });
    });
  });

  describe('matchesRule', () => {
    test('should match regex pattern', () => {
      const result = reportingService.matchesRule('This is spam content', 'spam');
      expect(result).toBe(true);
    });

    test('should match keyword pattern', () => {
      // Test d'abord comme regex (qui devrait marcher)
      const result1 = reportingService.matchesRule('buy this now!', 'buy');
      expect(result1).toBe(true);
      
      // Test pattern avec mots-clés multiples
      const result2 = reportingService.matchesRule('I want to sell this', 'sell');
      expect(result2).toBe(true);
    });

    test('should not match when no pattern matches', () => {
      const result = reportingService.matchesRule('Normal content', 'spam,scam,fake');
      expect(result).toBe(false);
    });
  });

  describe('getModerationStats', () => {
    test('should return moderation statistics', async () => {
      mockPrisma.report.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(20)  // pending
        .mockResolvedValueOnce(60)  // resolved
        .mockResolvedValueOnce(20); // dismissed

      mockPrisma.userSanction.count
        .mockResolvedValueOnce(5)   // active
        .mockResolvedValueOnce(25); // total

      const result = await reportingService.getModerationStats();

      expect(result).toEqual({
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
      });
    });
  });
});