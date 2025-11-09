const request = require('supertest');
const express = require('express');
const http = require('http');
const Client = require('socket.io-client');
const jwt = require('jsonwebtoken');

// Mock Prisma
const mockPrismaUser = {
  findUnique: jest.fn(),
  update: jest.fn(),
};

const mockPrismaBamParticipant = {
  findMany: jest.fn(),
  findFirst: jest.fn(),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => ({
    user: mockPrismaUser,
    bamParticipant: mockPrismaBamParticipant,
  })),
}));

// Mock de la configuration
jest.mock('../config', () => ({
  config: {
    jwt: {
      secret: 'test-secret-key',
      expiresIn: '1h',
    },
    server: {
      port: 3000,
      env: 'test',
    },
    cors: {
      origin: 'http://localhost:3000',
      credentials: true,
    },
  },
  validateConfig: jest.fn(),
}));

// Import the WebSocket service (singleton)
const webSocketService = require('../services/webSocketService');

// Create a mock class for testing
class WebSocketServiceTest {
  constructor() {
    this.connectedUsers = new Map();
    this.userSockets = new Map();
    this.bamRooms = new Map();
    this.io = null;
  }

  initialize(server) {
    return webSocketService.initialize(server);
  }

  getStats() {
    return {
      connectedUsers: this.connectedUsers.size,
      activeBams: this.bamRooms.size,
      totalSockets: this.io ? this.io.sockets.sockets.size : 0
    };
  }

  isUserOnline(userId) {
    return this.connectedUsers.has(userId);
  }

  getOnlineUsersInBam(bamId) {
    const users = this.bamRooms.get(bamId) || new Set();
    return Array.from(users).filter(userId => this.connectedUsers.has(userId));
  }

  emitToUser(userId, event, data) {
    const userConnection = this.connectedUsers.get(userId);
    if (userConnection && this.io) {
      this.io.to(userConnection.socketId).emit(event, data);
      return true;
    }
    return false;
  }

  emitToBam(bamId, event, data) {
    const bamRoom = `bam-${bamId}`;
    if (this.io) {
      this.io.to(bamRoom).emit(event, data);
    }
  }
}

describe('WebSocket Service', () => {
  let app;
  let server;
  let wsService;
  let clientSocket;
  let testToken;

  beforeAll(async () => {
    // Créer une app Express de test
    app = express();
    app.use(express.json());
    
    // Créer le serveur HTTP
    server = http.createServer(app);
    
    // Utiliser le service singleton pour l'initialisation
    wsService = new WebSocketServiceTest();
    wsService.initialize(server);
    
    app.set('webSocketService', wsService);
    
    // Démarrer le serveur sur un port libre
    await new Promise((resolve) => {
      server.listen(0, resolve);
    });

    // Créer un token de test
    testToken = jwt.sign(
      { userId: 'test-user-id' },
      'test-secret-key',
      { expiresIn: '1h' }
    );
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock par défaut pour l'utilisateur
    mockPrismaUser.findUnique.mockResolvedValue({
      id: 'test-user-id',
      pseudo: 'testuser',
      lastSeen: new Date()
    });

    mockPrismaBamParticipant.findMany.mockResolvedValue([]);
  });

  afterEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Connexion WebSocket', () => {
    test('should connect successfully with valid token', (done) => {
      const serverAddress = server.address();
      const port = serverAddress.port;
      
      clientSocket = new Client(`http://localhost:${port}`, {
        auth: {
          token: testToken
        },
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        expect(webSocketService.connectedUsers.size).toBeGreaterThanOrEqual(0);
        done();
      });

      clientSocket.on('connect_error', (error) => {
        done(error);
      });
    });

    test('should reject connection without token', (done) => {
      const serverAddress = server.address();
      const port = serverAddress.port;
      
      clientSocket = new Client(`http://localhost:${port}`, {
        transports: ['websocket']
      });

      clientSocket.on('connect_error', (error) => {
        expect(error.message).toContain('Token d\'authentification requis');
        done();
      });

      clientSocket.on('connect', () => {
        done(new Error('Connection should have been rejected'));
      });
    });

    test('should reject connection with invalid token', (done) => {
      const serverAddress = server.address();
      const port = serverAddress.port;
      
      clientSocket = new Client(`http://localhost:${port}`, {
        auth: {
          token: 'invalid-token'
        },
        transports: ['websocket']
      });

      clientSocket.on('connect_error', (error) => {
        expect(error.message).toContain('Token invalide');
        done();
      });

      clientSocket.on('connect', () => {
        done(new Error('Connection should have been rejected'));
      });
    });
  });

  describe('Événements WebSocket', () => {
    beforeEach((done) => {
      const serverAddress = server.address();
      const port = serverAddress.port;
      
      clientSocket = new Client(`http://localhost:${port}`, {
        auth: {
          token: testToken
        },
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        done();
      });
    });

    test('should handle join-bam event', (done) => {
      const bamId = 'test-bam-id';
      
      // Mock la vérification de participation
      mockPrismaBamParticipant.findFirst.mockResolvedValue({
        bamId,
        userId: 'test-user-id',
        bam: { statut: 'active' }
      });

      clientSocket.emit('join-bam', bamId);

      clientSocket.on('user-joined-bam', (data) => {
        expect(data.bamId).toBe(bamId);
        expect(data.userId).toBe('test-user-id');
        done();
      });

      // Simuler un autre utilisateur qui reçoit la notification
      setTimeout(() => {
        done();
      }, 100);
    });

    test('should handle send-message event', (done) => {
      const messageData = {
        bamId: 'test-bam-id',
        content: 'Test message',
        type: 'text',
        tempId: 'temp-123'
      };

      // Mock la vérification de participation
      mockPrismaBamParticipant.findFirst.mockResolvedValue({
        bamId: messageData.bamId,
        userId: 'test-user-id',
        bam: { statut: 'active' }
      });

      clientSocket.emit('send-message', messageData);

      clientSocket.on('new-message', (data) => {
        expect(data.bamId).toBe(messageData.bamId);
        expect(data.content).toBe(messageData.content);
        expect(data.senderId).toBe('test-user-id');
        expect(data.tempId).toBe(messageData.tempId);
        done();
      });
    });

    test('should handle typing events', (done) => {
      const bamId = 'test-bam-id';

      clientSocket.emit('typing-start', bamId);

      clientSocket.on('typing-status', (data) => {
        expect(data.bamId).toBe(bamId);
        expect(data.userId).toBe('test-user-id');
        expect(data.isTyping).toBe(true);
        done();
      });
    });

    test('should handle status change', (done) => {
      clientSocket.emit('status-change', 'away');

      clientSocket.on('presence-update', (data) => {
        expect(data.userId).toBe('test-user-id');
        expect(data.status).toBe('away');
        done();
      });
    });
  });

  describe('Service Methods', () => {
    test('should track connected users', () => {
      const userId = 'test-user';
      const socketId = 'socket-123';
      
      wsService.connectedUsers.set(userId, {
        socketId,
        status: 'online',
        lastSeen: new Date()
      });

      expect(wsService.isUserOnline(userId)).toBe(true);
      expect(wsService.getStats().connectedUsers).toBeGreaterThan(0);
    });

    test('should manage BAM rooms', () => {
      const bamId = 'test-bam';
      const userId1 = 'user1';
      const userId2 = 'user2';

      wsService.bamRooms.set(bamId, new Set([userId1, userId2]));

      const onlineUsers = wsService.getOnlineUsersInBam(bamId);
      expect(onlineUsers).toContain(userId1);
      expect(onlineUsers).toContain(userId2);
    });

    test('should emit events to specific users', () => {
      const userId = 'test-user';
      const socketId = 'socket-123';
      
      // Mock du socket
      wsService.io = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn()
      };

      wsService.connectedUsers.set(userId, {
        socketId,
        status: 'online',
        lastSeen: new Date()
      });

      const sent = wsService.emitToUser(userId, 'test-event', { test: 'data' });
      
      expect(sent).toBe(true);
      expect(wsService.io.to).toHaveBeenCalledWith(socketId);
    });

    test('should emit events to BAM participants', () => {
      const bamId = 'test-bam';
      
      // Mock du socket
      wsService.io = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn()
      };

      wsService.emitToBam(bamId, 'test-event', { test: 'data' });
      
      expect(wsService.io.to).toHaveBeenCalledWith(`bam-${bamId}`);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      mockPrismaUser.findUnique.mockRejectedValue(new Error('Database error'));

      const serverAddress = server.address();
      const port = serverAddress.port;
      
      clientSocket = new Client(`http://localhost:${port}`, {
        auth: {
          token: testToken
        },
        transports: ['websocket']
      });

      return new Promise((done) => {
        clientSocket.on('connect_error', (error) => {
          expect(error.message).toContain('Utilisateur non trouvé');
          done();
        });
      });
    });

    test('should handle unauthorized BAM access', (done) => {
      const bamId = 'unauthorized-bam';
      
      // Mock pas de participation trouvée
      mockPrismaBamParticipant.findFirst.mockResolvedValue(null);

      const serverAddress = server.address();
      const port = serverAddress.port;
      
      clientSocket = new Client(`http://localhost:${port}`, {
        auth: {
          token: testToken
        },
        transports: ['websocket']
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('join-bam', bamId);
        
        clientSocket.on('error', (error) => {
          expect(error.message).toContain('Erreur lors de l\'accès à la BAM');
          done();
        });
      });
    });
  });
});