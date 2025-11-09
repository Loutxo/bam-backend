const request = require('supertest');
const { createClient } = require('@supabase/supabase-js');

// Configuration
const API_URL = 'https://bam-api-supabase.vercel.app';
const SUPABASE_URL = 'https://tzlomhuhtmocywpjpyxd.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

describe('BAM API Integration Tests', () => {
  let authToken;
  let testUserId;
  let testBamId;

  // Test user credentials
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'Test123456!',
    username: `testuser${Date.now()}`,
    firstName: 'Test',
    lastName: 'User',
  };

  // ==================== Authentication Tests ====================
  describe('Authentication', () => {
    test('POST /auth/register - should create new user', async () => {
      const response = await request(API_URL)
        .post('/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('session');
      expect(response.body.user.email).toBe(testUser.email);
      
      authToken = response.body.session.access_token;
      testUserId = response.body.user.id;
    });

    test('POST /auth/register - should fail with duplicate email', async () => {
      await request(API_URL)
        .post('/auth/register')
        .send(testUser)
        .expect(400);
    });

    test('POST /auth/login - should authenticate user', async () => {
      const response = await request(API_URL)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body).toHaveProperty('session');
      expect(response.body).toHaveProperty('user');
      authToken = response.body.session.access_token;
    });

    test('POST /auth/login - should fail with wrong password', async () => {
      await request(API_URL)
        .post('/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword',
        })
        .expect(400);
    });

    test('GET /auth/me - should get current user', async () => {
      const response = await request(API_URL)
        .get('/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe(testUser.email);
    });

    test('GET /auth/me - should fail without token', async () => {
      await request(API_URL)
        .get('/auth/me')
        .expect(401);
    });
  });

  // ==================== BAM CRUD Tests ====================
  describe('BAM Operations', () => {
    const testBam = {
      title: 'Test BAM',
      description: 'This is a test BAM',
      category: 'danger',
      severity: 'modere',
      latitude: 48.8566,
      longitude: 2.3522,
    };

    test('POST /api/bams - should create new BAM', async () => {
      const response = await request(API_URL)
        .post('/api/bams')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testBam)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(testBam.title);
      expect(response.body.category).toBe(testBam.category);
      expect(response.body.status).toBe('signale');
      
      testBamId = response.body.id;
    });

    test('POST /api/bams - should fail without authentication', async () => {
      await request(API_URL)
        .post('/api/bams')
        .send(testBam)
        .expect(401);
    });

    test('POST /api/bams - should fail with missing required fields', async () => {
      await request(API_URL)
        .post('/api/bams')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Incomplete BAM',
          // Missing category, latitude, longitude
        })
        .expect(400);
    });

    test('GET /api/bams/:id - should get BAM by ID', async () => {
      const response = await request(API_URL)
        .get(`/api/bams/${testBamId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(testBamId);
      expect(response.body.title).toBe(testBam.title);
    });

    test('GET /api/bams/nearby - should find nearby BAMs', async () => {
      const response = await request(API_URL)
        .get('/api/bams/nearby')
        .query({
          latitude: 48.8566,
          longitude: 2.3522,
          radius: 10000, // 10km
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('distance');
    });

    test('PUT /api/bams/:id - should update BAM', async () => {
      const response = await request(API_URL)
        .put(`/api/bams/${testBamId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Updated Test BAM',
          status: 'en_cours',
        })
        .expect(200);

      expect(response.body.title).toBe('Updated Test BAM');
      expect(response.body.status).toBe('en_cours');
    });

    test('PUT /api/bams/:id - should fail to update others BAM', async () => {
      // Create another user
      const otherUser = {
        email: `other-${Date.now()}@example.com`,
        password: 'Test123456!',
        username: `otheruser${Date.now()}`,
        firstName: 'Other',
        lastName: 'User',
      };

      const registerResponse = await request(API_URL)
        .post('/auth/register')
        .send(otherUser);

      const otherToken = registerResponse.body.session.access_token;

      // Try to update test BAM with other user's token
      await request(API_URL)
        .put(`/api/bams/${testBamId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ title: 'Hacked!' })
        .expect(403);
    });

    test('DELETE /api/bams/:id - should delete BAM', async () => {
      await request(API_URL)
        .delete(`/api/bams/${testBamId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify deletion
      await request(API_URL)
        .get(`/api/bams/${testBamId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  // ==================== Review Tests ====================
  describe('Reviews', () => {
    let reviewBamId;

    beforeAll(async () => {
      // Create a BAM to review
      const bamResponse = await request(API_URL)
        .post('/api/bams')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'BAM for Review',
          category: 'travaux',
          severity: 'faible',
          latitude: 48.8566,
          longitude: 2.3522,
        });
      
      reviewBamId = bamResponse.body.id;
    });

    test('POST /api/reviews - should create review', async () => {
      const response = await request(API_URL)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bamId: reviewBamId,
          rating: 5,
          comment: 'Great BAM!',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.rating).toBe(5);
      expect(response.body.comment).toBe('Great BAM!');
    });

    test('POST /api/reviews - should fail with invalid rating', async () => {
      await request(API_URL)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bamId: reviewBamId,
          rating: 6, // Invalid: should be 1-5
          comment: 'Invalid rating',
        })
        .expect(400);
    });

    test('POST /api/reviews - should fail without authentication', async () => {
      await request(API_URL)
        .post('/api/reviews')
        .send({
          bamId: reviewBamId,
          rating: 4,
        })
        .expect(401);
    });
  });

  // ==================== Call Tests ====================
  describe('Calls', () => {
    let callBamId;

    beforeAll(async () => {
      // Create a BAM to call
      const bamResponse = await request(API_URL)
        .post('/api/bams')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'BAM for Call',
          category: 'accident',
          severity: 'eleve',
          latitude: 48.8566,
          longitude: 2.3522,
        });
      
      callBamId = bamResponse.body.id;
    });

    test('POST /api/calls - should log emergency call', async () => {
      const response = await request(API_URL)
        .post('/api/calls')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          bamId: callBamId,
          service: 'police',
          duration: 180,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.service).toBe('police');
      expect(response.body.duration).toBe(180);
    });

    test('POST /api/calls - should fail without authentication', async () => {
      await request(API_URL)
        .post('/api/calls')
        .send({
          bamId: callBamId,
          service: 'pompiers',
        })
        .expect(401);
    });
  });

  // ==================== Rate Limiting Tests ====================
  describe('Rate Limiting', () => {
    test('should enforce rate limits', async () => {
      const promises = [];
      
      // Send 101 requests rapidly (limit is 100/15min)
      for (let i = 0; i < 101; i++) {
        promises.push(
          request(API_URL)
            .get('/auth/me')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(promises);
      const tooManyRequests = responses.filter(r => r.status === 429);
      
      expect(tooManyRequests.length).toBeGreaterThan(0);
    }, 30000); // 30s timeout
  });

  // ==================== Cleanup ====================
  afterAll(async () => {
    // Clean up test user
    if (testUserId) {
      await supabase.auth.admin.deleteUser(testUserId);
    }
  });
});
