/**
 * Tests pour le système de gamification avancé
 * Points, badges, achievements, leaderboards, streaks
 */

const request = require('supertest');
const app = require('../test-server'); // Serveur de test isolé
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

describe('Système de Gamification Avancé', () => {
  let testUser, testUser2, testToken, testToken2;

  beforeAll(async () => {
    // Nettoyer les données de test
    await prisma.message.deleteMany({});
    await prisma.call.deleteMany({});
    await prisma.review.deleteMany({});
    await prisma.response.deleteMany({});
    await prisma.bam.deleteMany({});
    await prisma.userBadge.deleteMany({});
    await prisma.userAchievement.deleteMany({});
    await prisma.pointHistory.deleteMany({});
    await prisma.dailyStreak.deleteMany({});
    await prisma.badge.deleteMany({});
    await prisma.achievement.deleteMany({});
    await prisma.user.deleteMany({});

    // Créer des utilisateurs de test
    testUser = await prisma.user.create({
      data: {
        pseudo: 'GamerTest',
        email: 'gamer@test.com',
        profileImageUrl: 'https://example.com/avatar1.jpg',
        totalPoints: 0,
        currentLevel: 1
      }
    });

    testUser2 = await prisma.user.create({
      data: {
        pseudo: 'GamerTest2',
        email: 'gamer2@test.com',
        profileImageUrl: 'https://example.com/avatar2.jpg',
        totalPoints: 0,
        currentLevel: 1
      }
    });

    // Créer des tokens
    testToken = jwt.sign(
      { id: testUser.id, pseudo: testUser.pseudo },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '24h' }
    );

    testToken2 = jwt.sign(
      { id: testUser2.id, pseudo: testUser2.pseudo },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '24h' }
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Initialisation des badges', () => {
    it('devrait initialiser les badges par défaut', async () => {
      const response = await request(app)
        .post('/api/gamification/admin/init-badges')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.count).toBeGreaterThan(0);
      expect(response.body.data.badges).toBeInstanceOf(Array);
    });

    it('devrait récupérer tous les badges', async () => {
      const response = await request(app)
        .get('/api/gamification/badges')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('devrait filtrer les badges par catégorie', async () => {
      const response = await request(app)
        .get('/api/gamification/badges?category=CREATOR')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.forEach(badge => {
        expect(badge.category).toBe('CREATOR');
      });
    });
  });

  describe('Points et niveaux', () => {
    it('devrait récupérer les informations de points', async () => {
      const response = await request(app)
        .get(`/api/gamification/points/${testUser.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalPoints');
      expect(response.body.data).toHaveProperty('currentLevel');
    });

    it('devrait ajouter des points manuellement (admin)', async () => {
      const response = await request(app)
        .post('/api/gamification/admin/add-points')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          userId: testUser.id,
          points: 100,
          reason: 'Test points'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('pointsAwarded', 100);
    });

    it('devrait récupérer les informations de niveau', async () => {
      const response = await request(app)
        .get(`/api/gamification/level/${testUser.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('currentLevel');
      expect(response.body.data).toHaveProperty('totalPoints');
    });
  });

  describe('Actions utilisateur et gamification automatique', () => {
    it('devrait traiter une action BAM_CREATED', async () => {
      const response = await request(app)
        .post('/api/gamification/action')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          userId: testUser.id,
          action: 'BAM_CREATED',
          data: { bamId: 'test-bam-id' }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.action).toBe('BAM_CREATED');
      expect(response.body.data.pointsAwarded).toBeGreaterThan(0);
    });

    it('devrait traiter une action MESSAGE_SENT', async () => {
      const response = await request(app)
        .post('/api/gamification/action')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          userId: testUser.id,
          action: 'MESSAGE_SENT'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.action).toBe('MESSAGE_SENT');
    });

    it('devrait traiter une connexion quotidienne', async () => {
      const response = await request(app)
        .post(`/api/gamification/streak/login/${testUser.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('isFirstToday');
      expect(response.body.data).toHaveProperty('currentStreak');
    });
  });

  describe('Badges et achievements', () => {
    it('devrait vérifier et attribuer de nouveaux badges', async () => {
      // D'abord s'assurer qu'on a des points/activités
      await request(app)
        .post('/api/gamification/action')
        .set('Authorization', `Bearer ${testUser.id}`)
        .send({
          userId: testUser.id,
          action: 'BAM_CREATED'
        });

      const response = await request(app)
        .post(`/api/gamification/badges/check/${testUser.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('newBadges');
      expect(response.body.data).toHaveProperty('count');
    });

    it('devrait récupérer les badges d\'un utilisateur', async () => {
      const response = await request(app)
        .get(`/api/gamification/badges/user/${testUser.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('devrait récupérer tous les achievements', async () => {
      const response = await request(app)
        .get('/api/gamification/achievements')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('devrait récupérer les achievements d\'un utilisateur', async () => {
      const response = await request(app)
        .get(`/api/gamification/achievements/user/${testUser.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });
  });

  describe('Streaks quotidiennes', () => {
    it('devrait récupérer les informations de streak', async () => {
      const response = await request(app)
        .get(`/api/gamification/streak/${testUser.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('currentStreak');
      expect(response.body.data).toHaveProperty('longestStreak');
    });
  });

  describe('Leaderboards', () => {
    beforeAll(async () => {
      // Ajouter des points différents aux utilisateurs pour tester le classement
      await request(app)
        .post('/api/gamification/admin/add-points')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          userId: testUser.id,
          points: 500,
          reason: 'Test leaderboard'
        });

      await request(app)
        .post('/api/gamification/admin/add-points')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          userId: testUser2.id,
          points: 300,
          reason: 'Test leaderboard 2'
        });
    });

    it('devrait récupérer le classement par points', async () => {
      const response = await request(app)
        .get('/api/gamification/leaderboard/points')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('leaderboard');
      expect(response.body.data).toHaveProperty('period');
      expect(response.body.data.leaderboard).toBeInstanceOf(Array);
      expect(response.body.data.leaderboard.length).toBeGreaterThan(0);
    });

    it('devrait récupérer la position d\'un utilisateur', async () => {
      const response = await request(app)
        .get(`/api/gamification/leaderboard/position/${testUser.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('position');
      expect(response.body.data).toHaveProperty('totalPoints');
      expect(response.body.data.position).toBeGreaterThan(0);
    });

    it('devrait filtrer le leaderboard par période', async () => {
      const response = await request(app)
        .get('/api/gamification/leaderboard/points?period=WEEKLY&limit=5')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.period).toBe('WEEKLY');
      expect(response.body.data.leaderboard.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Statistiques complètes', () => {
    it('devrait récupérer les statistiques complètes d\'un utilisateur', async () => {
      const response = await request(app)
        .get(`/api/gamification/stats/${testUser.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('level');
      expect(response.body.data).toHaveProperty('badges');
      expect(response.body.data).toHaveProperty('achievements');
      expect(response.body.data).toHaveProperty('streak');
      expect(response.body.data).toHaveProperty('leaderboard');
      expect(response.body.data).toHaveProperty('recentPoints');

      // Vérifier la structure des données
      expect(response.body.data.level).toHaveProperty('current');
      expect(response.body.data.level).toHaveProperty('totalPoints');
      expect(response.body.data.level).toHaveProperty('progressPercent');

      expect(response.body.data.badges).toHaveProperty('total');
      expect(response.body.data.badges).toHaveProperty('recent');
      expect(response.body.data.badges).toHaveProperty('byRarity');
    });
  });

  describe('Sécurité et permissions', () => {
    it('devrait interdire l\'accès aux stats d\'un autre utilisateur', async () => {
      await request(app)
        .get(`/api/gamification/stats/${testUser2.id}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(403);
    });

    it('devrait interdire les actions admin sans permissions', async () => {
      // Créer un utilisateur non-admin
      const normalUser = await prisma.user.create({
        data: {
          pseudo: 'NormalUser',
          email: 'normal@test.com',
          role: 'user'
        }
      });

      const normalToken = jwt.sign(
        { id: normalUser.id, pseudo: normalUser.pseudo, role: 'user' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '24h' }
      );

      await request(app)
        .post('/api/gamification/admin/add-points')
        .set('Authorization', `Bearer ${normalToken}`)
        .send({
          userId: testUser.id,
          points: 100,
          reason: 'Test unauthorized'
        })
        .expect(403);
    });

    it('devrait exiger une authentification', async () => {
      await request(app)
        .get('/api/gamification/badges')
        .expect(401);
    });

    it('devrait valider les paramètres requis', async () => {
      await request(app)
        .post('/api/gamification/action')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          // userId manquant
          action: 'BAM_CREATED'
        })
        .expect(400);
    });
  });

  describe('Gestion des erreurs', () => {
    it('devrait gérer gracieusement les utilisateurs inexistants', async () => {
      const fakeUserId = '00000000-0000-0000-0000-000000000000';
      
      await request(app)
        .get(`/api/gamification/points/${fakeUserId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .expect(403); // Forbidden car l'utilisateur connecté ne peut pas voir ces stats
    });

    it('devrait gérer les actions inconnues', async () => {
      const response = await request(app)
        .post('/api/gamification/action')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          userId: testUser.id,
          action: 'UNKNOWN_ACTION'
        })
        .expect(200); // L'action doit passer mais sans effet

      expect(response.body.data.pointsAwarded).toBe(0);
    });
  });
});

// Exports pour tests supprimés car variables locales au describe