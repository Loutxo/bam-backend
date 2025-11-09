const GamificationService = require('../services/gamificationService');

// Mock Prisma Client
const mockPrisma = {
  pointTransaction: {
    create: jest.fn(),
  },
  user: {
    update: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  badge: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
  userBadge: {
    findUnique: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
  },
  achievement: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
  userAchievement: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  bam: {
    count: jest.fn(),
  },
  response: {
    count: jest.fn(),
  },
  message: {
    count: jest.fn(),
  },
  call: {
    count: jest.fn(),
  }
};

// Mock du PrismaClient
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => mockPrisma)
  };
});

describe('GamificationService', () => {
  let gamificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Créer une nouvelle instance pour chaque test
    GamificationService.instance = null;
    gamificationService = new GamificationService();
  });

  describe('Configuration et constantes', () => {
    test('should have correct point values', () => {
      expect(GamificationService.POINT_VALUES.BAM_CREATED).toBe(10);
      expect(GamificationService.POINT_VALUES.BAM_JOINED).toBe(5);
      expect(GamificationService.POINT_VALUES.MESSAGE_SENT).toBe(1);
      expect(GamificationService.POINT_VALUES.CALL_COMPLETED).toBe(15);
    });

    test('should have level thresholds', () => {
      expect(GamificationService.LEVEL_THRESHOLDS).toHaveLength(10);
      expect(GamificationService.LEVEL_THRESHOLDS[0]).toEqual({ level: 1, minPoints: 0 });
      expect(GamificationService.LEVEL_THRESHOLDS[9]).toEqual({ level: 10, minPoints: 3000 });
    });

    test('should be a singleton', () => {
      const instance1 = new GamificationService();
      const instance2 = new GamificationService();
      expect(instance1).toBe(instance2);
    });
  });

  describe('calculateLevel', () => {
    test('should calculate correct level for different point values', () => {
      expect(gamificationService.calculateLevel(0)).toBe(1);
      expect(gamificationService.calculateLevel(25)).toBe(1);
      expect(gamificationService.calculateLevel(50)).toBe(2);
      expect(gamificationService.calculateLevel(200)).toBe(3);
      expect(gamificationService.calculateLevel(1000)).toBe(7);
      expect(gamificationService.calculateLevel(5000)).toBe(10);
    });
  });

  describe('awardPoints', () => {
    test('should award points successfully', async () => {
      const userId = 'user-123';
      const mockUser = {
        id: userId,
        pseudo: 'TestUser',
        totalPoints: 100,
        currentLevel: 2
      };

      mockPrisma.pointTransaction.create.mockResolvedValue({
        id: 'transaction-123',
        userId,
        points: 10,
        reason: 'BAM_CREATED',
        description: '+10 points pour avoir créé une BAM',
        createdAt: new Date()
      });

      mockPrisma.user.update.mockResolvedValue(mockUser);

      // Mock pour les achievements et badges (vide pour éviter erreurs)
      mockPrisma.achievement.findMany.mockResolvedValue([]);
      mockPrisma.bam.count.mockResolvedValue(0);

      const result = await gamificationService.awardPoints(userId, 'BAM_CREATED');

      expect(mockPrisma.pointTransaction.create).toHaveBeenCalledWith({
        data: {
          userId,
          points: 10,
          reason: 'BAM_CREATED',
          description: '+10 points pour avoir créé une BAM',
          relatedId: null
        }
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { totalPoints: { increment: 10 } },
        select: {
          id: true,
          pseudo: true,
          totalPoints: true,
          currentLevel: true
        }
      });

      expect(result.success).toBe(true);
      expect(result.pointsAwarded).toBe(10);
    });

    test('should handle level up', async () => {
      const userId = 'user-123';
      const mockUser = {
        id: userId,
        pseudo: 'TestUser',
        totalPoints: 149, // Avant ajout
        currentLevel: 2
      };

      mockPrisma.pointTransaction.create.mockResolvedValue({
        id: 'transaction-123',
        userId,
        points: 10,
        reason: 'BAM_CREATED'
      });

      // Mock pour les achievements (vide pour éviter l'erreur)
      mockPrisma.achievement.findMany.mockResolvedValue([]);

      // Premier update pour incrémenter les points
      mockPrisma.user.update.mockResolvedValueOnce({
        ...mockUser,
        totalPoints: 159 // Après ajout
      });
      
      // Deuxième update pour le niveau (sera appelé si niveau change)
      mockPrisma.user.update.mockResolvedValueOnce({ 
        ...mockUser, 
        totalPoints: 159,
        currentLevel: 3 
      });

      const result = await gamificationService.awardPoints(userId, 'BAM_CREATED');

      expect(result.levelChanged).toBe(true);
      expect(result.newLevel).toBe(3);
      expect(result.previousLevel).toBe(2);
    });

    test('should handle invalid reason', async () => {
      const userId = 'user-123';
      
      const result = await gamificationService.awardPoints(userId, 'INVALID_REASON');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Action non récompensée');
    });
  });

  describe('getUserPointsStats', () => {
    test('should return user point statistics', async () => {
      const userId = 'user-123';
      const mockUser = {
        id: userId,
        pseudo: 'TestUser',
        totalPoints: 200,
        currentLevel: 3,
        pointHistory: [
          {
            id: 'trans-1',
            points: 10,
            reason: 'BAM_CREATED',
            description: 'Créé une BAM',
            createdAt: new Date()
          }
        ]
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const stats = await gamificationService.getUserPointsStats(userId);

      expect(stats.user.totalPoints).toBe(200);
      expect(stats.user.currentLevel).toBe(3);
      expect(stats.progression.currentLevel).toBe(3);
      expect(stats.progression.nextLevel).toBe(4);
      expect(stats.recentTransactions).toHaveLength(1);
    });

    test('should handle user not found', async () => {
      const userId = 'nonexistent-user';
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(gamificationService.getUserPointsStats(userId))
        .rejects.toThrow('Utilisateur non trouvé');
    });
  });

  describe('Badge System', () => {
    test('should award badge successfully', async () => {
      const userId = 'user-123';
      const badgeName = 'Premier Pas';
      
      const mockBadge = {
        id: 'badge-123',
        name: badgeName,
        pointsReward: 10
      };

      mockPrisma.badge.findUnique.mockResolvedValue(mockBadge);
      mockPrisma.userBadge.findUnique.mockResolvedValue(null); // Pas encore possédé
      mockPrisma.userBadge.create.mockResolvedValue({
        id: 'user-badge-123',
        userId,
        badgeId: mockBadge.id,
        earnedAt: new Date(),
        badge: mockBadge
      });

      // Mock pour l'attribution des points bonus
      mockPrisma.pointTransaction.create.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({
        id: userId,
        totalPoints: 110,
        currentLevel: 2,
        pseudo: 'TestUser'
      });

      const result = await gamificationService.awardBadge(userId, badgeName);

      expect(result.success).toBe(true);
      expect(result.badge.name).toBe(badgeName);
      expect(result.pointsAwarded).toBe(10);
    });

    test('should not award badge twice', async () => {
      const userId = 'user-123';
      const badgeName = 'Premier Pas';
      
      const mockBadge = { id: 'badge-123', name: badgeName };
      mockPrisma.badge.findUnique.mockResolvedValue(mockBadge);
      mockPrisma.userBadge.findUnique.mockResolvedValue({
        id: 'existing-user-badge'
      }); // Déjà possédé

      const result = await gamificationService.awardBadge(userId, badgeName);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Badge déjà possédé');
    });
  });

  describe('Leaderboard', () => {
    test('should return points leaderboard', async () => {
      const mockUsers = [
        { id: 'user-1', pseudo: 'Leader', totalPoints: 1000, currentLevel: 7 },
        { id: 'user-2', pseudo: 'Second', totalPoints: 500, currentLevel: 5 },
        { id: 'user-3', pseudo: 'Third', totalPoints: 250, currentLevel: 3 }
      ];

      mockPrisma.user.findMany.mockResolvedValue(mockUsers);

      const leaderboard = await gamificationService.getPointsLeaderboard(3, 0);

      expect(leaderboard).toHaveLength(3);
      expect(leaderboard[0].rank).toBe(1);
      expect(leaderboard[0].user.pseudo).toBe('Leader');
      expect(leaderboard[1].rank).toBe(2);
      expect(leaderboard[2].rank).toBe(3);
    });

    test('should return user rank', async () => {
      const userId = 'user-123';
      const mockUser = {
        id: userId,
        pseudo: 'TestUser',
        totalPoints: 300,
        currentLevel: 4
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.count.mockResolvedValue(5); // 5 utilisateurs avec plus de points

      const userRank = await gamificationService.getUserRank(userId);

      expect(userRank.rank).toBe(6); // 5 + 1
      expect(userRank.user.pseudo).toBe('TestUser');
    });
  });

  describe('Default Description Generation', () => {
    test('should generate correct descriptions', () => {
      expect(gamificationService.getDefaultDescription('BAM_CREATED', 10))
        .toBe('+10 points pour avoir créé une BAM');
      
      expect(gamificationService.getDefaultDescription('MESSAGE_SENT', 1))
        .toBe('+1 point pour un message envoyé');
      
      expect(gamificationService.getDefaultDescription('UNKNOWN_REASON', 5))
        .toBe('5 points');
    });
  });

  describe('Initialization', () => {
    test('should initialize default badges', async () => {
      // Mock pour vérifier si badges existent
      mockPrisma.badge.findUnique.mockResolvedValue(null); // Aucun badge existant
      
      // Mock pour création des badges
      mockPrisma.badge.create.mockResolvedValue({
        id: 'badge-123',
        name: 'Premier Pas'
      });

      const badges = await gamificationService.initializeDefaultBadges();

      expect(badges.length).toBeGreaterThan(0);
      expect(mockPrisma.badge.create).toHaveBeenCalled();
    });

    test('should initialize default achievements', async () => {
      // Mock pour vérifier si achievements existent
      mockPrisma.achievement.findUnique.mockResolvedValue(null);
      
      // Mock pour création des achievements
      mockPrisma.achievement.create.mockResolvedValue({
        id: 'achievement-123',
        name: 'Créateur Novice'
      });

      const achievements = await gamificationService.initializeDefaultAchievements();

      expect(achievements.length).toBeGreaterThan(0);
      expect(mockPrisma.achievement.create).toHaveBeenCalled();
    });
  });
});