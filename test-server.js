/**
 * Serveur de test complet pour Postman - API BAM Phase 2
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = 3000;

// Middlewares de base
app.use(helmet());
app.use(cors());
app.use(express.json());

// Mock responses pour tests Postman
const mockResponses = {
  health: { status: 'OK', uptime: process.uptime(), timestamp: new Date() },
  
  // Auth responses
  register: (body) => ({
    success: true,
    data: {
      user: {
        id: `user_${Date.now()}`,
        pseudo: body.pseudo || 'TestUser',
        email: body.email || 'test@example.com'
      },
      accessToken: `jwt_token_${Date.now()}`,
      refreshToken: `refresh_${Date.now()}`
    },
    message: 'Utilisateur créé avec succès'
  }),

  // Gamification
  profile: {
    success: true,
    data: {
      userId: 'user_123',
      totalPoints: 1250,
      currentLevel: 5,
      badges: [
        { id: 'first_bam', name: 'Premier BAM', rarity: 'COMMON', earnedAt: new Date() },
        { id: 'social_butterfly', name: 'Papillon Social', rarity: 'RARE', earnedAt: new Date() }
      ],
      dailyStreak: { currentStreak: 7, longestStreak: 15 },
      leaderboardPosition: { position: 42, category: 'weekly' }
    }
  },

  // Géolocalisation
  locationStats: {
    success: true,
    data: {
      totalLocations: 156,
      favoriteZones: 3,
      totalVisits: 28,
      unreadAlerts: 2,
      citiesVisited: 5,
      topCities: [
        { city: 'Paris', visits: 89 },
        { city: 'Lyon', visits: 34 },
        { city: 'Marseille', visits: 21 }
      ]
    }
  },

  // Admin Dashboard
  adminStats: {
    success: true,
    data: {
      overview: {
        totalUsers: 1024,
        activeUsers: 245,
        totalBAMs: 892,
        activeBAMs: 156,
        totalMessages: 15420,
        userGrowthRate: '23.9'
      },
      moderation: {
        totalReports: 89,
        pendingReports: 12,
        totalSanctions: 23,
        reportResolutionRate: '86.5'
      }
    }
  }
};

// Routes principales pour tests
app.get('/', (req, res) => {
  res.json({
    message: '🧭 BAM API Phase 2 - Test Mode',
    version: '2.0.0',
    phase: 'Phase 2 Complete',
    features: ['Signalement', 'Gamification', 'Géolocalisation', 'Admin Dashboard'],
    timestamp: new Date()
  });
});

app.get('/health', (req, res) => res.json(mockResponses.health));

// AUTH
app.post('/auth/register', (req, res) => res.status(201).json(mockResponses.register(req.body)));
app.post('/auth/login', (req, res) => res.json(mockResponses.register(req.body)));

// SIGNALEMENT
app.post('/reports', (req, res) => {
  res.status(201).json({
    success: true,
    data: {
      id: `report_${Date.now()}`,
      type: req.body.type || 'INAPPROPRIATE_CONTENT',
      reason: req.body.reason || 'Test signalement',
      status: 'PENDING',
      createdAt: new Date()
    },
    message: 'Signalement créé avec succès'
  });
});

app.get('/reports/my-reports', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 'report_1',
        type: 'INAPPROPRIATE_CONTENT',
        reason: 'Contenu inapproprié',
        status: 'PENDING',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
      }
    ],
    count: 1
  });
});

app.get('/reports/stats', (req, res) => {
  res.json({
    success: true,
    data: {
      totalReports: 15,
      pendingReports: 3,
      resolvedReports: 12,
      myReports: 2
    }
  });
});

// GAMIFICATION
app.get('/gamification/profile', (req, res) => res.json(mockResponses.profile));

app.post('/gamification/points/add', (req, res) => {
  res.json({
    success: true,
    data: {
      pointsAdded: req.body.points || 25,
      newTotal: 1275,
      levelUp: false
    },
    message: 'Points ajoutés avec succès'
  });
});

app.get('/gamification/points/history', (req, res) => {
  res.json({
    success: true,
    data: [
      { points: 25, reason: 'Test manuel', category: 'ENGAGEMENT', createdAt: new Date() },
      { points: 50, reason: 'Création BAM', category: 'CREATION', createdAt: new Date(Date.now() - 60 * 60 * 1000) }
    ],
    count: 2
  });
});

app.get('/gamification/badges', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'first_bam', name: 'Premier BAM', description: 'Créer votre premier BAM', rarity: 'COMMON' },
      { id: 'social_butterfly', name: 'Papillon Social', description: '10 conversations', rarity: 'RARE' },
      { id: 'explorer', name: 'Explorateur', description: 'Visiter 5 villes', rarity: 'EPIC' }
    ]
  });
});

app.get('/gamification/badges/my-badges', (req, res) => {
  res.json({
    success: true,
    data: mockResponses.profile.data.badges
  });
});

app.get('/gamification/streaks/daily', (req, res) => {
  res.json({
    success: true,
    data: mockResponses.profile.data.dailyStreak
  });
});

app.post('/gamification/streaks/daily/increment', (req, res) => {
  res.json({
    success: true,
    data: {
      currentStreak: 8,
      longestStreak: 15,
      bonusEarned: 10
    },
    message: 'Streak incrémentée !'
  });
});

app.get('/gamification/leaderboards/general', (req, res) => {
  res.json({
    success: true,
    data: [
      { position: 1, pseudo: 'SuperUser', points: 2500 },
      { position: 2, pseudo: 'BAMExpert', points: 2200 },
      { position: 3, pseudo: 'SocialKing', points: 1950 }
    ]
  });
});

app.get('/gamification/leaderboards/my-position', (req, res) => {
  res.json({
    success: true,
    data: mockResponses.profile.data.leaderboardPosition
  });
});

// GÉOLOCALISATION
app.post('/location/record', (req, res) => {
  res.status(201).json({
    success: true,
    data: {
      id: `location_${Date.now()}`,
      latitude: req.body.latitude || 48.8566,
      longitude: req.body.longitude || 2.3522,
      accuracy: req.body.accuracy || 10,
      address: req.body.address || 'Paris, France',
      createdAt: new Date()
    },
    message: 'Position enregistrée'
  });
});

app.get('/location/history', (req, res) => {
  res.json({
    success: true,
    data: [
      { latitude: 48.8566, longitude: 2.3522, address: 'Paris', createdAt: new Date() },
      { latitude: 45.7640, longitude: 4.8357, address: 'Lyon', createdAt: new Date(Date.now() - 60 * 60 * 1000) }
    ],
    count: 2
  });
});

app.get('/location/current', (req, res) => {
  res.json({
    success: true,
    data: {
      latitude: 48.8566,
      longitude: 2.3522,
      address: 'Paris, France',
      createdAt: new Date()
    }
  });
});

app.post('/location/zones', (req, res) => {
  res.status(201).json({
    success: true,
    data: {
      id: `zone_${Date.now()}`,
      name: req.body.name || 'Zone Test',
      latitude: req.body.latitude || 48.8566,
      longitude: req.body.longitude || 2.3522,
      radius: req.body.radius || 500,
      color: req.body.color || '#3B82F6',
      createdAt: new Date()
    },
    message: 'Zone favorite créée'
  });
});

app.get('/location/zones', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 'zone_1',
        name: 'Mon Bureau',
        latitude: 48.8566,
        longitude: 2.3522,
        radius: 500,
        color: '#3B82F6'
      }
    ],
    count: 1
  });
});

app.get('/location/alerts', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 'alert_1',
        type: 'ZONE_ENTER',
        title: 'Entrée zone Bureau',
        message: 'Vous êtes entré dans votre zone "Mon Bureau"',
        isRead: false,
        createdAt: new Date()
      }
    ],
    count: 1
  });
});

app.post('/location/distance', (req, res) => {
  // Calcul simple pour test
  const distance = 391000; // Paris-Lyon environ
  res.json({
    success: true,
    data: {
      distance,
      unit: 'meters'
    }
  });
});

app.get('/location/stats', (req, res) => res.json(mockResponses.locationStats));

// ADMIN DASHBOARD
app.get('/admin/dashboard/stats', (req, res) => res.json(mockResponses.adminStats));

app.get('/admin/users', (req, res) => {
  res.json({
    success: true,
    data: {
      users: [
        { id: 'user_1', pseudo: 'TestUser1', email: 'test1@example.com', createdAt: new Date() },
        { id: 'user_2', pseudo: 'TestUser2', email: 'test2@example.com', createdAt: new Date() }
      ],
      pagination: { page: 1, limit: 20, total: 2, pages: 1 }
    }
  });
});

app.get('/admin/moderation/queue', (req, res) => {
  res.json({
    success: true,
    data: {
      pendingReports: [
        { id: 'report_1', type: 'INAPPROPRIATE_CONTENT', status: 'PENDING', createdAt: new Date() }
      ],
      recentSanctions: [],
      flaggedContent: []
    }
  });
});

app.get('/admin/analytics/usage', (req, res) => {
  res.json({
    success: true,
    data: {
      dailyActiveUsers: 245,
      popularLocations: [{ city: 'Paris', visits: 89 }],
      peakHours: [{ hour: '18:00', count: 45 }],
      deviceStats: [{ source: 'GPS', count: 156 }]
    }
  });
});

// WEBSOCKET
app.get('/websocket/stats', (req, res) => {
  res.json({
    success: true,
    data: {
      connectedUsers: 42,
      activeRooms: 15,
      totalMessages: 1250
    }
  });
});

app.get('/websocket/users', (req, res) => {
  res.json({
    success: true,
    data: [
      { userId: 'user_1', pseudo: 'TestUser1', status: 'online' },
      { userId: 'user_2', pseudo: 'TestUser2', status: 'away' }
    ]
  });
});

// Démarrage serveur
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`
🎉 BAM API Phase 2 - Mode Test Postman
🚀 Serveur démarré sur http://localhost:${PORT}

✅ ENDPOINTS DISPONIBLES POUR TESTS:
   📊 Statistiques: GET /
   🩺 Santé: GET /health
   🔐 Auth: POST /auth/register, /auth/login  
   🛡️ Signalement: POST /reports, GET /reports/*
   🏆 Gamification: GET /gamification/*
   📍 Géolocalisation: GET/POST /location/*
   🏢 Admin: GET /admin/*
   🔌 WebSocket: GET /websocket/*

🎯 PRÊT POUR LES TESTS POSTMAN !
    `);
  });
}

module.exports = app;