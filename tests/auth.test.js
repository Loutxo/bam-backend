const { hashPassword, comparePassword, validatePasswordStrength } = require('../utils/password');
const { generateToken, verifyToken } = require('../middleware/auth');

// Mock de la configuration pour les tests
jest.mock('../config', () => ({
  config: {
    jwt: {
      secret: 'test-secret-key-for-jwt-testing',
      expiresIn: '1h',
    },
    security: {
      bcryptRounds: 4, // Réduire pour les tests
    },
  },
}));

describe('Password Utils', () => {
  describe('hashPassword', () => {
    test('should hash password correctly', async () => {
      const password = 'testpassword123';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
    });

    test('should generate different hashes for same password', async () => {
      const password = 'testpassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('comparePassword', () => {
    test('should verify correct password', async () => {
      const password = 'testpassword123';
      const hash = await hashPassword(password);
      const isValid = await comparePassword(password, hash);

      expect(isValid).toBe(true);
    });

    test('should reject incorrect password', async () => {
      const password = 'testpassword123';
      const wrongPassword = 'wrongpassword456';
      const hash = await hashPassword(password);
      const isValid = await comparePassword(wrongPassword, hash);

      expect(isValid).toBe(false);
    });
  });

  describe('validatePasswordStrength', () => {
    test('should validate strong password', () => {
      const strongPassword = 'StrongP@ssw0rd123';
      const result = validatePasswordStrength(strongPassword);

      expect(result.isValid).toBe(true);
      expect(result.score).toBe(100);
      expect(result.suggestions).toHaveLength(0);
    });

    test('should reject weak password', () => {
      const weakPassword = '123';
      const result = validatePasswordStrength(weakPassword);

      expect(result.isValid).toBe(false);
      expect(result.score).toBeLessThan(80);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    test('should provide helpful suggestions', () => {
      const weakPassword = 'password';
      const result = validatePasswordStrength(weakPassword);

      expect(result.suggestions).toContain('Ajoutez au moins une lettre majuscule');
      expect(result.suggestions).toContain('Ajoutez au moins un chiffre');
      expect(result.suggestions).toContain('Ajoutez au moins un caractère spécial (!@#$%^&*...)');
    });
  });
});

describe('JWT Auth', () => {
  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    pseudo: 'testuser',
    phone: '+33123456789',
  };

  describe('generateToken', () => {
    test('should generate valid JWT token', () => {
      const token = generateToken(mockUser);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT a 3 parties
    });
  });

  describe('verifyToken', () => {
    test('should verify valid token', () => {
      const token = generateToken(mockUser);
      const decoded = verifyToken(token);

      expect(decoded.id).toBe(mockUser.id);
      expect(decoded.pseudo).toBe(mockUser.pseudo);
      expect(decoded.phone).toBe(mockUser.phone);
    });

    test('should throw error for invalid token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => verifyToken(invalidToken)).toThrow('Token invalide');
    });

    test('should throw error for empty token', () => {
      expect(() => verifyToken('')).toThrow('Token invalide');
    });
  });
});
