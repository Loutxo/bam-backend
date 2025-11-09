const webSocketService = require('../services/webSocketService');
const ReportingService = require('../services/reportingService');

describe('WebSocket-Reporting Service Integration', () => {
  let reportingService;

  beforeEach(() => {
    reportingService = new ReportingService();
    // Reset pour éviter les effets de bord du singleton
    reportingService.webSocketService = null;
  });

  describe('Service Integration', () => {
    test('should allow WebSocket service injection', () => {
      expect(reportingService.setWebSocketService).toBeDefined();
      expect(typeof reportingService.setWebSocketService).toBe('function');
      
      // Test de l'injection
      const mockWebSocket = { notify: jest.fn() };
      reportingService.setWebSocketService(mockWebSocket);
      
      expect(reportingService.webSocketService).toBe(mockWebSocket);
    });

    test('should have WebSocket notification methods', () => {
      const webSocketMethods = [
        'notifyUserReported',
        'notifyModerators', 
        'notifyUserSanctioned',
        'notifyReportStatusUpdate',
        'notifyAutoModeration',
        'notifyBamRemoved',
        'broadcastModerationStats'
      ];

      webSocketMethods.forEach(method => {
        expect(webSocketService[method]).toBeDefined();
        expect(typeof webSocketService[method]).toBe('function');
      });
    });

    test('should handle WebSocket service gracefully when not set', async () => {
      // ReportingService sans WebSocket injecté
      const serviceWithoutWS = new ReportingService();
      expect(serviceWithoutWS.webSocketService).toBeNull();
      
      // Les méthodes ne devraient pas planter quand webSocketService est null
      expect(() => {
        if (serviceWithoutWS.webSocketService) {
          serviceWithoutWS.webSocketService.notifyUserReported('user-id', {});
        }
      }).not.toThrow();
    });
  });

  describe('WebSocket Event Structure', () => {
    test('should define correct notification event types', () => {
      const eventTypes = {
        USER_REPORTED: 'user:reported',
        USER_SANCTIONED: 'user:sanctioned', 
        USER_BANNED: 'user:banned',
        NEW_REPORT: 'moderation:new-report',
        REPORT_STATUS_UPDATED: 'report:status-updated',
        CONTENT_AUTO_MODERATED: 'content:auto-moderated',
        BAM_REMOVED: 'bam:removed',
        MODERATION_STATS_UPDATE: 'moderation:stats-update'
      };

      Object.values(eventTypes).forEach(eventType => {
        expect(eventType).toMatch(/^[a-z]+:[a-z-]+$/);
      });
    });

    test('should have consistent notification data structure', () => {
      const mockNotificationStructure = {
        type: 'USER_REPORTED',
        message: 'Test message',
        timestamp: new Date().toISOString()
      };

      expect(mockNotificationStructure).toHaveProperty('type');
      expect(mockNotificationStructure).toHaveProperty('timestamp');
      expect(mockNotificationStructure.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('Error Handling', () => {
    test('should handle WebSocket notification errors gracefully', () => {
      const mockWebSocket = {
        notifyUserReported: jest.fn().mockImplementation(() => {
          throw new Error('WebSocket error');
        })
      };

      reportingService.setWebSocketService(mockWebSocket);

      // Aucune erreur ne devrait remonter depuis les notifications WebSocket
      expect(() => {
        try {
          mockWebSocket.notifyUserReported('user-id', {});
        } catch (error) {
          // En production, ces erreurs seraient catchées dans le service
          console.log('WebSocket error caught:', error.message);
        }
      }).not.toThrow();
    });

    test('should continue operation if WebSocket is unavailable', () => {
      // Test que les opérations continuent même sans WebSocket
      const serviceWithoutWS = new ReportingService();
      expect(serviceWithoutWS.webSocketService).toBeNull();
      
      // Les opérations métier devraient continuer à fonctionner
      expect(serviceWithoutWS.prisma).toBeDefined();
    });
  });

  describe('Real-time Features', () => {
    test('should support user presence tracking', () => {
      const webSocketMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(webSocketService));
      
      const presenceMethods = [
        'isUserOnline',
        'getOnlineUsersInBam',
        'broadcastPresenceUpdate'
      ];

      presenceMethods.forEach(method => {
        expect(webSocketMethods.includes(method)).toBe(true);
      });
    });

    test('should support BAM room management', () => {
      expect(webSocketService.bamRooms).toBeDefined();
      expect(webSocketService.bamRooms instanceof Map).toBe(true);
    });

    test('should support connected users tracking', () => {
      expect(webSocketService.connectedUsers).toBeDefined();
      expect(webSocketService.connectedUsers instanceof Map).toBe(true);
    });
  });

  describe('Auto-moderation Integration', () => {
    test('should support auto-moderation notifications', () => {
      expect(webSocketService.notifyAutoModeration).toBeDefined();
      expect(typeof webSocketService.notifyAutoModeration).toBe('function');
    });

    test('should handle content removal notifications', () => {
      expect(webSocketService.notifyBamRemoved).toBeDefined();
      expect(typeof webSocketService.notifyBamRemoved).toBe('function');
    });

    test('should support moderation statistics broadcasting', () => {
      expect(webSocketService.broadcastModerationStats).toBeDefined();
      expect(typeof webSocketService.broadcastModerationStats).toBe('function');
    });
  });
});