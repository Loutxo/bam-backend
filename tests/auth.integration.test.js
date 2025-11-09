const request = require('supertest');

// Configuration pour les tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.REFRESH_JWT_SECRET = 'test-refresh-secret-key';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/bam_test';

describe('Auth Routes Integration (E2E)', () => {
  let app;
  let server;

  beforeAll((done) => {
    // Importer l'app après avoir configuré l'environnement
    delete require.cache[require.resolve('../index.js')];

    // Créer un serveur pour les tests
    const express = require('express');
    const authRoutes = require('../routes/auth');

    app = express();
    app.use(express.json());
    app.use('/auth', authRoutes);

    // Middleware d'erreur pour capturer les erreurs
    app.use((err, req, res, _next) => {
      console.error('Test Error:', err);
      res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        details: err.details,
      });
    });

    server = app.listen(0, done); // Port aléatoire pour les tests
  });

  afterAll((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  describe('POST /auth/register', () => {
    test('should validate request format', async () => {
      const invalidUser = {
        pseudo: 'testuser',
        phone: '+33123456789',
        // Pas de password
      };

      const response = await request(app)
        .post('/auth/register')
        .send(invalidUser);

      expect([400, 422]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
    });

    test('should reject weak password', async () => {
      const newUser = {
        pseudo: 'testuser',
        phone: '+33123456789',
        password: '123', // Mot de passe faible
      };

      const response = await request(app)
        .post('/auth/register')
        .send(newUser);

      expect([400, 422]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
    });

    test('should reject invalid phone number', async () => {
      const newUser = {
        pseudo: 'testuser',
        phone: 'invalid-phone',
        password: 'StrongP@ssw0rd123',
      };

      const response = await request(app)
        .post('/auth/register')
        .send(newUser);

      expect([400, 422]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /auth/login', () => {
    test('should validate login request format', async () => {
      const invalidLogin = {
        phone: '+33123456789',
        // Pas de password
      };

      const response = await request(app)
        .post('/auth/login')
        .send(invalidLogin);

      expect([400, 422]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle missing credentials gracefully', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({});

      expect([400, 422]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /auth/refresh', () => {
    test('should validate refresh token format', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .send({});

      expect([400, 401, 403, 422]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
    });

    test('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect([400, 403, 422]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
    });
  });
});
