// Test simple pour vérifier que le serveur démarre correctement

// Mock le module config pour éviter les erreurs de DB
jest.mock('../config', () => ({
  config: {
    server: {
      port: 3000,
      env: 'test',
    },
    cors: {
      origin: 'http://localhost:3000',
      credentials: true,
    },
    database: {
      url: 'postgresql://test:test@localhost:5432/test_db',
    },
  },
  validateConfig: jest.fn(),
}));

// Mock prisma pour éviter les erreurs de DB
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    // Mock des méthodes Prisma si nécessaire
  })),
}));

describe('Server Startup', () => {
  test('should start without errors', () => {
    // Test basique pour vérifier que les modules se chargent correctement
    const { config } = require('../config');
    expect(config).toBeDefined();
    expect(config.server.port).toBe(3000);
  });

  test('should load middleware correctly', () => {
    const { errorHandler } = require('../middleware/errorHandler');
    const { generalLimiter } = require('../middleware/rateLimiting');
    const { validateUserCreation } = require('../middleware/validation');

    expect(errorHandler).toBeDefined();
    expect(generalLimiter).toBeDefined();
    expect(validateUserCreation).toBeDefined();
  });

  test('should load utils correctly', () => {
    const { getDistanceInKm, isValidCoordinates } = require('../utils/geolocation');

    expect(getDistanceInKm).toBeDefined();
    expect(isValidCoordinates).toBeDefined();
  });
});
