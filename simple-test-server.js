/**
 * Serveur ultra-simple pour tests Postman
 */

const http = require('http');

const PORT = 3000;

// Mock data
const mockData = {
  health: { status: 'OK', uptime: process.uptime(), timestamp: new Date() },
  apiInfo: {
    message: '🧭 BAM API Phase 2 - Test Mode',
    version: '2.0.0',
    phase: 'Phase 2 Complete',
    features: ['Signalement', 'Gamification', 'Géolocalisation', 'Admin Dashboard'],
    timestamp: new Date()
  },
  gamificationProfile: {
    success: true,
    data: {
      userId: 'user_123',
      totalPoints: 1250,
      currentLevel: 5,
      badges: [
        { id: 'first_bam', name: 'Premier BAM', rarity: 'COMMON' },
        { id: 'social_butterfly', name: 'Papillon Social', rarity: 'RARE' }
      ],
      dailyStreak: { currentStreak: 7, longestStreak: 15 }
    }
  }
};

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method;

  console.log(`${method} ${path}`);

  // Handle OPTIONS requests
  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Routes
  try {
    if (path === '/health') {
      res.writeHead(200);
      res.end(JSON.stringify(mockData.health));
      
    } else if (path === '/') {
      res.writeHead(200);
      res.end(JSON.stringify(mockData.apiInfo));
      
    } else if (path === '/auth/register' && method === 'POST') {
      res.writeHead(201);
      res.end(JSON.stringify({
        success: true,
        data: {
          user: { id: 'user_' + Date.now(), pseudo: 'TestUser', email: 'test@example.com' },
          accessToken: 'jwt_token_' + Date.now()
        },
        message: 'Utilisateur créé avec succès'
      }));
      
    } else if (path === '/reports' && method === 'POST') {
      res.writeHead(201);
      res.end(JSON.stringify({
        success: true,
        data: { id: 'report_' + Date.now(), type: 'INAPPROPRIATE_CONTENT', status: 'PENDING' },
        message: 'Signalement créé avec succès'
      }));
      
    } else if (path === '/reports/stats') {
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: { totalReports: 15, pendingReports: 3, resolvedReports: 12 }
      }));
      
    } else if (path === '/gamification/profile') {
      res.writeHead(200);
      res.end(JSON.stringify(mockData.gamificationProfile));
      
    } else if (path === '/gamification/badges') {
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: [
          { id: 'first_bam', name: 'Premier BAM', rarity: 'COMMON' },
          { id: 'social_butterfly', name: 'Papillon Social', rarity: 'RARE' },
          { id: 'explorer', name: 'Explorateur', rarity: 'EPIC' }
        ]
      }));
      
    } else if (path === '/gamification/points/add' && method === 'POST') {
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: { pointsAdded: 25, newTotal: 1275, levelUp: false },
        message: 'Points ajoutés avec succès'
      }));
      
    } else if (path === '/location/record' && method === 'POST') {
      res.writeHead(201);
      res.end(JSON.stringify({
        success: true,
        data: { id: 'loc_' + Date.now(), latitude: 48.8566, longitude: 2.3522 },
        message: 'Position enregistrée'
      }));
      
    } else if (path === '/location/stats') {
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: { totalLocations: 156, favoriteZones: 3, citiesVisited: 5 }
      }));
      
    } else if (path === '/location/zones' && method === 'POST') {
      res.writeHead(201);
      res.end(JSON.stringify({
        success: true,
        data: { id: 'zone_' + Date.now(), name: 'Zone Test', radius: 500 },
        message: 'Zone favorite créée'
      }));
      
    } else if (path === '/admin/dashboard/stats') {
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: {
          overview: { totalUsers: 1024, activeUsers: 245, totalBAMs: 892 },
          moderation: { totalReports: 89, pendingReports: 12 }
        }
      }));
      
    } else if (path === '/websocket/stats') {
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: { connectedUsers: 42, activeRooms: 15, totalMessages: 1250 }
      }));
      
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Endpoint non trouvé', path, method }));
    }
    
  } catch (error) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: 'Erreur serveur', message: error.message }));
  }
});

server.listen(PORT, () => {
  console.log(`
🎉 BAM API Phase 2 - Serveur de Test Simplifié
🚀 Serveur démarré sur http://localhost:${PORT}

✅ ENDPOINTS TESTABLES:
   📊 GET / - Informations API
   🩺 GET /health - Health check
   🔐 POST /auth/register - Inscription utilisateur
   🛡️ POST /reports - Créer signalement  
   📈 GET /reports/stats - Stats signalement
   🏆 GET /gamification/profile - Profil gamification
   🏅 GET /gamification/badges - Liste badges
   ➕ POST /gamification/points/add - Ajouter points
   📍 POST /location/record - Enregistrer position
   📊 GET /location/stats - Stats géolocalisation
   🎯 POST /location/zones - Créer zone favorite
   🏢 GET /admin/dashboard/stats - Stats admin
   🔌 GET /websocket/stats - Stats WebSocket

🎯 PRÊT POUR LES TESTS !
  `);
});

server.on('error', (error) => {
  console.error('Erreur serveur:', error);
});

module.exports = server;