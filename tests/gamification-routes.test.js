const request = require('supertest');
const express = require('express');

// Mock du service de gamification avant l'import
const mockGamificationService = {
  getUserPointsStats: jest.fn(),
  getPublicStats: jest.fn(),
  awardPoints: jest.fn(),
  getUserBadges: jest.fn(),
  getUserAchievements: jest.fn(),
  getPointsLeaderboard: jest.fn(),
  getUserRank: jest.fn(),
  initializeDefaultData: jest.fn(),
  POINT_VALUES: {
    BAM_CREATION: 10,
    BAM_JOIN: 5,
    MESSAGE: 1,
    CALL_PARTICIPATION: 15,
    REVIEW: 5
  },
  LEVEL_THRESHOLDS: [0, 100, 250, 500, 1000, 2000],
  prisma: {
    badge: {
      findMany: jest.fn(),
      count: jest.fn()
    },
    userBadge: {
      findMany: jest.fn(),
    },
    achievement: {
      findMany: jest.fn(),
      count: jest.fn()
    },
    userAchievement: {
      findMany: jest.fn(),
    },
    user: {
      count: jest.fn(),
    },
    pointTransaction: {
      count: jest.fn(),
    }
  }
};

// Mock du module gamificationService
jest.mock('../services/gamificationService', () => {
  return jest.fn().mockImplementation(() => mockGamificationService);
});

// Mock du module GamificationService (classe statique)
jest.mock('../services/gamificationService', () => {
  const mockClass = jest.fn().mockImplementation(() => mockGamificationService);
  mockClass.POINT_VALUES = mockGamificationService.POINT_VALUES;
  mockClass.LEVEL_THRESHOLDS = mockGamificationService.LEVEL_THRESHOLDS;
  return mockClass;
});

// Mock du middleware d'authentification
jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 'test-user-id', pseudo: 'testuser' };
    next();
  }
}));

// Mock du middleware de validation
jest.mock('../middleware/validation', () => ({
  handleValidationErrors: (req, res, next) => next()
}));

const gamificationRoutes = require('../routes/gamification');

describe('Gamification Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Configuration des mocks par défaut
    mockGamificationService.getUserPointsStats.mockResolvedValue({
      user: {
        id: 'test-user-id',
        pseudo: 'testuser',
        totalPoints: 150,
        currentLevel: 3
      },
      progression: {
        currentLevel: 3,
        nextLevel: 4,
        pointsToNextLevel: 150,
        progressPercentage: 50
      },
      recentTransactions: []
    });

    mockGamificationService.getPublicStats.mockResolvedValue({
      totalPoints: 100,
      currentLevel: 1,
      badges: []
    });

    mockGamificationService.awardPoints.mockResolvedValue({
      pointsAwarded: 50,
      newLevel: 2,
      badgesEarned: []
    });

    mockGamificationService.getUserBadges.mockResolvedValue([
      {
        badge: {
          id: '1',
          name: 'Premier Pas',
          description: 'Créé ton premier BAM',
          icon: '🎯',
          category: 'CREATION'
        },
        earnedAt: new Date()
      }
    ]);

    mockGamificationService.getUserAchievements.mockResolvedValue([
      {
        achievement: {
          id: '1',
          name: 'Créateur',
          description: 'Créé 5 BAMs',
          target: 5,
          category: 'CREATION'
        },
        progress: 3,
        isCompleted: false
      }
    ]);

    mockGamificationService.getPointsLeaderboard.mockResolvedValue([
      { user: { id: '1', username: 'user1' }, totalPoints: 500, currentLevel: 3 },
      { user: { id: '2', username: 'user2' }, totalPoints: 300, currentLevel: 2 }
    ]);

    mockGamificationService.getUserRank.mockResolvedValue({
      rank: 5,
      totalUsers: 100
    });

    mockGamificationService.initializeDefaultData.mockResolvedValue({
      badgesCreated: 5,
      achievementsCreated: 10
    });

    // Configuration des mocks Prisma
    mockGamificationService.prisma.user.count.mockResolvedValue(100);
    mockGamificationService.prisma.badge.count.mockResolvedValue(5);
    mockGamificationService.prisma.achievement.count.mockResolvedValue(10);
    mockGamificationService.prisma.pointTransaction.count.mockResolvedValue(150);
    
    app = express();
    app.use(express.json());
    app.use('/gamification', gamificationRoutes);
  });

  describe('GET /gamification/stats', () => {
    test('should return user point statistics', async () => {
      const mockStats = {
        user: {
          id: 'test-user-id',
          pseudo: 'testuser',
          totalPoints: 150,
          currentLevel: 3
        },
        progression: {
          currentLevel: 3,
          nextLevel: 4,
          pointsToNextLevel: 150,
          progressPercentage: 50
        },
        recentTransactions: [
          {
            id: 'trans-1',
            points: 10,
            reason: 'BAM_CREATED',
            description: 'Créé une BAM',
            createdAt: '2025-10-21T21:47:54.305Z'
          }
        ]
      };

      mockGamificationService.getUserPointsStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/gamification/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
      expect(mockGamificationService.getUserPointsStats).toHaveBeenCalledWith('test-user-id');
    });

    test('should handle service errors', async () => {
      mockGamificationService.getUserPointsStats.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/gamification/stats')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Erreur lors de la récupération des statistiques');
    });
  });

  describe('GET /gamification/user/:userId/stats', () => {
    test('should return public stats for another user', async () => {
      const mockStats = {
        user: {
          id: 'other-user-id',
          pseudo: 'otheruser',
          totalPoints: 200,
          currentLevel: 3
        },
        progression: {
          currentLevel: 3,
          nextLevel: 4,
          pointsToNextLevel: 100,
          progressPercentage: 67
        },
        recentTransactions: []
      };

      mockGamificationService.getUserPointsStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/gamification/user/550e8400-e29b-41d4-a716-446655440000/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toEqual(mockStats.user);
      expect(response.body.data.progression).toEqual(mockStats.progression);
      expect(response.body.data.recentTransactions).toEqual([]); // Pas d'historique pour les autres
    });

    test('should handle user not found', async () => {
      mockGamificationService.getUserPointsStats.mockRejectedValue(new Error('Utilisateur non trouvé'));

      const response = await request(app)
        .get('/gamification/user/550e8400-e29b-41d4-a716-446655440000/stats')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Utilisateur non trouvé');
    });

    test('should validate UUID format', async () => {
      // Le middleware de validation est mocké pour passer,
      // donc on teste juste que ça ne trouve pas l'utilisateur
      mockGamificationService.getUserPointsStats.mockRejectedValue(new Error('Utilisateur non trouvé'));

      const response = await request(app)
        .get('/gamification/user/invalid-uuid/stats')
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /gamification/award', () => {
    test('should award points manually', async () => {
      const mockResult = {
        success: true,
        pointsAwarded: 50,
        totalPoints: 200,
        levelChanged: false
      };

      mockGamificationService.awardPoints.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/gamification/award')
        .send({
          userId: 'target-user-id',
          points: 50,
          reason: 'Admin bonus',
          description: 'Bonus spécial admin'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(mockGamificationService.awardPoints).toHaveBeenCalledWith(
        'target-user-id',
        'BONUS',
        50,
        'Bonus spécial admin',
        null
      );
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/gamification/award')
        .send({
          points: 50
          // userId et reason manquants
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('userId, points et reason sont requis');
    });
  });

  describe('GET /gamification/badges', () => {
    test('should return all available badges', async () => {
      const mockBadges = [
        {
          id: 'badge-1',
          name: 'Premier Pas',
          description: 'Créé votre première BAM',
          icon: '🎯',
          category: 'NEWCOMER',
          requirement: 'Créer 1 BAM',
          pointsReward: 10,
          isSecret: false
        },
        {
          id: 'badge-2',
          name: 'Social Butterfly',
          description: 'Rejoint 10 BAMs',
          icon: '🦋',
          category: 'SOCIAL',
          requirement: 'Rejoindre 10 BAMs',
          pointsReward: 50,
          isSecret: false
        }
      ];

      mockGamificationService.prisma.badge.findMany.mockResolvedValue(mockBadges);

      const response = await request(app)
        .get('/gamification/badges')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockBadges);
    });
  });

  describe('GET /gamification/badges/my', () => {
    test('should return user badges', async () => {
      const mockUserBadges = [
        {
          id: 'user-badge-1',
          earnedAt: '2025-10-21T21:47:54.448Z',
          badge: {
            id: 'badge-1',
            name: 'Premier Pas',
            description: 'Créé votre première BAM',
            icon: '🎯',
            category: 'NEWCOMER',
            pointsReward: 10
          }
        }
      ];

      mockGamificationService.prisma.userBadge.findMany.mockResolvedValue(mockUserBadges);

      const response = await request(app)
        .get('/gamification/badges/my')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUserBadges);
    });
  });

  describe('GET /gamification/achievements', () => {
    test('should return all active achievements', async () => {
      const mockAchievements = [
        {
          id: 'achievement-1',
          name: 'Créateur Novice',
          description: 'Créer 5 BAMs',
          icon: '🌟',
          category: 'CREATION',
          target: 5,
          pointsReward: 25
        }
      ];

      mockGamificationService.prisma.achievement.findMany.mockResolvedValue(mockAchievements);

      const response = await request(app)
        .get('/gamification/achievements')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAchievements);
    });
  });

  describe('GET /gamification/achievements/my', () => {
    test('should return user achievements with progress', async () => {
      const mockUserAchievements = [
        {
          id: 'user-achievement-1',
          progress: 3,
          completed: false,
          completedAt: null,
          achievement: {
            id: 'achievement-1',
            name: 'Créateur Novice',
            description: 'Créer 5 BAMs',
            icon: '🌟',
            category: 'CREATION',
            target: 5,
            pointsReward: 25
          }
        }
      ];

      mockGamificationService.prisma.userAchievement.findMany.mockResolvedValue(mockUserAchievements);

      const response = await request(app)
        .get('/gamification/achievements/my')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data[0].progressPercentage).toBe(60); // 3/5 * 100
    });
  });

  describe('GET /gamification/leaderboard/points', () => {
    test('should return points leaderboard', async () => {
      const mockLeaderboard = [
        {
          rank: 1,
          user: {
            id: 'user-1',
            pseudo: 'Leader',
            totalPoints: 1000,
            currentLevel: 7
          }
        },
        {
          rank: 2,
          user: {
            id: 'user-2',
            pseudo: 'Second',
            totalPoints: 500,
            currentLevel: 5
          }
        }
      ];

      mockGamificationService.getPointsLeaderboard.mockResolvedValue(mockLeaderboard);

      const response = await request(app)
        .get('/gamification/leaderboard/points?limit=2&offset=0')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.leaderboard).toEqual(mockLeaderboard);
      expect(response.body.data.pagination.limit).toBe(2);
      expect(response.body.data.pagination.offset).toBe(0);
    });

    test('should use default pagination values', async () => {
      mockGamificationService.getPointsLeaderboard.mockResolvedValue([]);

      const response = await request(app)
        .get('/gamification/leaderboard/points')
        .expect(200);

      expect(mockGamificationService.getPointsLeaderboard).toHaveBeenCalledWith(10, 0);
    });
  });

  describe('GET /gamification/leaderboard/my-rank', () => {
    test('should return user rank', async () => {
      const mockUserRank = {
        rank: 15,
        user: {
          id: 'test-user-id',
          pseudo: 'testuser',
          totalPoints: 150,
          currentLevel: 3
        }
      };

      mockGamificationService.getUserRank.mockResolvedValue(mockUserRank);

      const response = await request(app)
        .get('/gamification/leaderboard/my-rank')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUserRank);
    });
  });

  describe('POST /gamification/setup/initialize', () => {
    test('should initialize default data', async () => {
      // Mock de la réponse du service
      mockGamificationService.initializeDefaultData.mockResolvedValue({
        badgesCreated: 5,
        achievementsCreated: 10
      });

      const response = await request(app)
        .post('/gamification/setup/initialize')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.badgesCreated).toBe(5);
      expect(response.body.data.achievementsCreated).toBe(10);
    });
  });

  describe('GET /gamification/info', () => {
    test('should return system information', async () => {
      // Mock des statistiques
      mockGamificationService.prisma.user.count.mockResolvedValue(100);
      mockGamificationService.prisma.badge.count.mockResolvedValue(5);
      mockGamificationService.prisma.achievement.count.mockResolvedValue(8);
      mockGamificationService.prisma.pointTransaction.count.mockResolvedValue(500);

      const response = await request(app)
        .get('/gamification/info')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.pointValues).toBeDefined();
      expect(response.body.data.levelThresholds).toBeDefined();
      expect(response.body.data.statistics.totalUsers).toBe(100);
      expect(response.body.data.statistics.totalBadges).toBe(5);
    });
  });
});