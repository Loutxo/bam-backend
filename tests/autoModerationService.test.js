const AutoModerationService = require('../services/autoModerationService');
const { PrismaClient } = require('@prisma/client');

// Mock Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    autoModerationRule: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn()
    }
  }))
}));

describe('AutoModerationService', () => {
  let autoModerationService;
  let mockPrisma;

  beforeEach(() => {
    jest.clearAllMocks();
    autoModerationService = new AutoModerationService();
    mockPrisma = autoModerationService.prisma;
  });

  describe('initializeDefaultRules', () => {
    test('should create default rules successfully', async () => {
      const mockRule = {
        id: 'rule-id',
        name: 'Mots haineux',
        description: 'Détection de mots à caractère haineux',
        pattern: 'hate,offensive,bad',
        action: 'HIDE',
        severity: 9,
        isActive: true
      };

      mockPrisma.autoModerationRule.findUnique.mockResolvedValue(null); // Rule doesn't exist
      mockPrisma.autoModerationRule.create.mockResolvedValue(mockRule);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await autoModerationService.initializeDefaultRules();

      expect(result.length).toBeGreaterThan(0);
      expect(mockPrisma.autoModerationRule.create).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('✅ Règle créée:'));

      consoleSpy.mockRestore();
    });

    test('should skip existing rules', async () => {
      const existingRule = { id: 'existing-rule', name: 'Existing Rule' };
      
      mockPrisma.autoModerationRule.findUnique.mockResolvedValue(existingRule);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const result = await autoModerationService.initializeDefaultRules();

      expect(result.length).toBe(0);
      expect(mockPrisma.autoModerationRule.create).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('⚠️  Règle existante:'));

      consoleSpy.mockRestore();
    });
  });

  describe('createCustomRule', () => {
    test('should create custom rule successfully', async () => {
      const ruleData = {
        name: 'Custom Rule',
        description: 'Custom moderation rule',
        pattern: 'custom,pattern',
        action: 'FLAG',
        severity: 5,
        isActive: true
      };

      const mockCreatedRule = { id: 'rule-id', ...ruleData };
      mockPrisma.autoModerationRule.create.mockResolvedValue(mockCreatedRule);

      const result = await autoModerationService.createCustomRule(ruleData);

      expect(result).toEqual(mockCreatedRule);
      expect(mockPrisma.autoModerationRule.create).toHaveBeenCalledWith({
        data: {
          name: 'Custom Rule',
          description: 'Custom moderation rule',
          pattern: 'custom,pattern',
          action: 'FLAG',
          severity: 5,
          isActive: true
        }
      });
    });
  });

  describe('updateRule', () => {
    test('should update rule successfully', async () => {
      const updates = { severity: 8, isActive: false };
      const mockUpdatedRule = { id: 'rule-id', ...updates };

      mockPrisma.autoModerationRule.update.mockResolvedValue(mockUpdatedRule);

      const result = await autoModerationService.updateRule('rule-id', updates);

      expect(result).toEqual(mockUpdatedRule);
      expect(mockPrisma.autoModerationRule.update).toHaveBeenCalledWith({
        where: { id: 'rule-id' },
        data: updates
      });
    });
  });

  describe('toggleRule', () => {
    test('should toggle rule activation', async () => {
      const mockUpdatedRule = { id: 'rule-id', isActive: false };
      mockPrisma.autoModerationRule.update.mockResolvedValue(mockUpdatedRule);

      const result = await autoModerationService.toggleRule('rule-id', false);

      expect(result).toEqual(mockUpdatedRule);
      expect(mockPrisma.autoModerationRule.update).toHaveBeenCalledWith({
        where: { id: 'rule-id' },
        data: { isActive: false }
      });
    });
  });

  describe('getAllRules', () => {
    test('should return all rules ordered correctly', async () => {
      const mockRules = [
        { id: 'rule-1', name: 'Rule 1', isActive: true, severity: 9 },
        { id: 'rule-2', name: 'Rule 2', isActive: false, severity: 5 }
      ];

      mockPrisma.autoModerationRule.findMany.mockResolvedValue(mockRules);

      const result = await autoModerationService.getAllRules();

      expect(result).toEqual(mockRules);
      expect(mockPrisma.autoModerationRule.findMany).toHaveBeenCalledWith({
        orderBy: [
          { isActive: 'desc' },
          { severity: 'desc' },
          { name: 'asc' }
        ]
      });
    });
  });

  describe('getRulesStats', () => {
    test('should return rules statistics', async () => {
      const mockTopRules = [
        { name: 'Rule 1', triggeredCount: 10, severity: 9, action: 'HIDE' },
        { name: 'Rule 2', triggeredCount: 5, severity: 7, action: 'FLAG' }
      ];

      mockPrisma.autoModerationRule.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(8)  // active
        .mockResolvedValueOnce(2); // inactive

      mockPrisma.autoModerationRule.aggregate.mockResolvedValue({
        _sum: { triggeredCount: 25 }
      });

      mockPrisma.autoModerationRule.findMany.mockResolvedValue(mockTopRules);

      const result = await autoModerationService.getRulesStats();

      expect(result).toEqual({
        summary: {
          total: 10,
          active: 8,
          inactive: 2,
          totalTriggers: 25
        },
        topTriggered: mockTopRules
      });
    });
  });

  describe('deleteRule', () => {
    test('should delete rule successfully', async () => {
      const mockDeletedRule = { id: 'rule-id', name: 'Deleted Rule' };
      mockPrisma.autoModerationRule.delete.mockResolvedValue(mockDeletedRule);

      const result = await autoModerationService.deleteRule('rule-id');

      expect(result).toEqual(mockDeletedRule);
      expect(mockPrisma.autoModerationRule.delete).toHaveBeenCalledWith({
        where: { id: 'rule-id' }
      });
    });
  });

  describe('testRule', () => {
    test('should match regex pattern', () => {
      const result = autoModerationService.testRule('This is spam content', 'spam');
      expect(result).toBe(true);
    });

    test('should match case-insensitive', () => {
      const result = autoModerationService.testRule('This is SPAM content', 'spam');
      expect(result).toBe(true);
    });

    test('should match keyword pattern', () => {
      const result = autoModerationService.testRule('Buy this now!', 'buy,sell,purchase');
      expect(result).toBe(true);
    });

    test('should not match when pattern does not match', () => {
      const result = autoModerationService.testRule('Normal content here', 'spam,scam,fake');
      expect(result).toBe(false);
    });

    test('should handle complex regex patterns', () => {
      const result = autoModerationService.testRule('AAAAAAAAAAAAAA', '(.)\\1{10,}');
      expect(result).toBe(true);
    });

    test('should handle invalid regex gracefully', () => {
      // Should fall back to keyword matching
      const result = autoModerationService.testRule('test content', '[invalid regex');
      expect(result).toBe(false);
    });
  });

  describe('simulateModeration', () => {
    test('should return no triggers for clean content', async () => {
      mockPrisma.autoModerationRule.findMany.mockResolvedValue([]);

      const result = await autoModerationService.simulateModeration('This is clean content');

      expect(result).toEqual({
        wouldTrigger: false,
        matchedRules: [],
        recommendedAction: 'NONE',
        severity: 0
      });
    });

    test('should return highest severity rule when multiple match', async () => {
      const mockRules = [
        {
          id: 'rule-1',
          name: 'Low Severity',
          pattern: 'spam',
          action: 'FLAG',
          severity: 3,
          description: 'Low severity rule'
        },
        {
          id: 'rule-2',
          name: 'High Severity',
          pattern: 'hate',
          action: 'DELETE',
          severity: 9,
          description: 'High severity rule'
        }
      ];

      mockPrisma.autoModerationRule.findMany.mockResolvedValue(mockRules);

      const result = await autoModerationService.simulateModeration('This has hate and spam content');

      expect(result.wouldTrigger).toBe(true);
      expect(result.matchedRules).toHaveLength(2);
      expect(result.recommendedAction).toBe('DELETE');
      expect(result.severity).toBe(9);
    });

    test('should return single matched rule', async () => {
      const mockRules = [
        {
          id: 'rule-1',
          name: 'Spam Detection',
          pattern: 'spam',
          action: 'FLAG',
          severity: 5,
          description: 'Detects spam content'
        }
      ];

      mockPrisma.autoModerationRule.findMany.mockResolvedValue(mockRules);

      const result = await autoModerationService.simulateModeration('This is spam content');

      expect(result.wouldTrigger).toBe(true);
      expect(result.matchedRules).toHaveLength(1);
      expect(result.matchedRules[0].name).toBe('Spam Detection');
      expect(result.recommendedAction).toBe('FLAG');
      expect(result.severity).toBe(5);
    });

    test('should handle rules with keyword patterns', async () => {
      const mockRules = [
        {
          id: 'rule-1',
          name: 'Keyword Rule',
          pattern: 'buy,sell,purchase',
          action: 'FLAG',
          severity: 4,
          description: 'Commercial keywords'
        }
      ];

      mockPrisma.autoModerationRule.findMany.mockResolvedValue(mockRules);

      const result = await autoModerationService.simulateModeration('Want to buy this item?');

      expect(result.wouldTrigger).toBe(true);
      expect(result.matchedRules).toHaveLength(1);
      expect(result.recommendedAction).toBe('FLAG');
    });
  });

  describe('edge cases', () => {
    test('should handle empty content', async () => {
      mockPrisma.autoModerationRule.findMany.mockResolvedValue([]);

      const result = await autoModerationService.simulateModeration('');

      expect(result.wouldTrigger).toBe(false);
    });

    test('should handle null/undefined patterns gracefully', () => {
      const result1 = autoModerationService.testRule('test content', null);
      expect(result1).toBe(false);

      const result2 = autoModerationService.testRule('test content', undefined);
      expect(result2).toBe(false);
    });

    test('should handle special characters in content', async () => {
      const mockRules = [
        {
          id: 'rule-1',
          name: 'Special Chars',
          pattern: '[!@#$%^&*()]{5,}',
          action: 'FLAG',
          severity: 3,
          description: 'Too many special chars'
        }
      ];

      mockPrisma.autoModerationRule.findMany.mockResolvedValue(mockRules);

      const result = await autoModerationService.simulateModeration('What?!?!?!?!?!');

      expect(result.wouldTrigger).toBe(true);
      expect(result.recommendedAction).toBe('FLAG');
    });
  });
});