/**
 * Serveur de test ultra-robuste pour BAM API
 */

const http = require('http');
const url = require('url');

const PORT = 3000;

console.log('🚀 Démarrage du serveur...');

const server = http.createServer((req, res) => {
  try {
    // Headers CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    const urlParts = url.parse(req.url, true);
    const path = urlParts.pathname;
    const method = req.method;

    console.log(`${new Date().toISOString()} - ${method} ${path}`);

    // OPTIONS requests
    if (method === 'OPTIONS') {
      res.writeHead(200);
      res.end('OK');
      return;
    }

    // Routes principales
    if (path === '/health') {
      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'OK',
        uptime: process.uptime(),
        timestamp: new Date(),
        message: 'Serveur BAM API fonctionnel'
      }));

    } else if (path === '/') {
      res.writeHead(200);
      res.end(JSON.stringify({
        message: '🧭 BAM API Phase 2 - Test Mode',
        version: '2.0.0',
        phase: 'Phase 2 Complete',
        features: ['Signalement', 'Gamification', 'Géolocalisation', 'Admin Dashboard'],
        timestamp: new Date(),
        endpoints_available: 27
      }));

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
        data: { id: 'report_' + Date.now(), type: 'INAPPROPRIATE_CONTENT', status: 'PENDING', createdAt: new Date() },
        message: 'Signalement créé avec succès'
      }));

    } else if (path === '/reports/stats') {
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: { totalReports: 15, pendingReports: 3, resolvedReports: 12, myReports: 2 }
      }));

    } else if (path === '/gamification/profile') {
      res.writeHead(200);
      res.end(JSON.stringify({
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
      }));

    } else if (path === '/gamification/badges') {
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: [
          { id: 'first_bam', name: 'Premier BAM', description: 'Créer votre premier BAM', rarity: 'COMMON' },
          { id: 'social_butterfly', name: 'Papillon Social', description: '10 conversations', rarity: 'RARE' },
          { id: 'explorer', name: 'Explorateur', description: 'Visiter 5 villes', rarity: 'EPIC' }
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
        data: { id: 'location_' + Date.now(), latitude: 48.8566, longitude: 2.3522, accuracy: 10, address: 'Paris, France', createdAt: new Date() },
        message: 'Position enregistrée'
      }));

    } else if (path === '/location/stats') {
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: { totalLocations: 156, favoriteZones: 3, totalVisits: 28, unreadAlerts: 2, citiesVisited: 5 }
      }));

    } else if (path === '/location/zones' && method === 'POST') {
      res.writeHead(201);
      res.end(JSON.stringify({
        success: true,
        data: { id: 'zone_' + Date.now(), name: 'Zone Test', latitude: 48.8566, longitude: 2.3522, radius: 500, color: '#3B82F6', createdAt: new Date() },
        message: 'Zone favorite créée'
      }));

    } else if (path === '/admin/dashboard/stats') {
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        data: {
          overview: { totalUsers: 1024, activeUsers: 245, totalBAMs: 892, activeBAMs: 156, totalMessages: 15420, userGrowthRate: '23.9' },
          moderation: { totalReports: 89, pendingReports: 12, totalSanctions: 23, reportResolutionRate: '86.5' }
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
      res.end(JSON.stringify({ 
        error: 'Endpoint non trouvé', 
        path: path, 
        method: method,
        availableEndpoints: ['/health', '/', '/auth/register', '/reports', '/gamification/*', '/location/*', '/admin/*', '/websocket/*']
      }));
    }

  } catch (error) {
    console.error('Erreur dans la requête:', error);
    res.writeHead(500);
    res.end(JSON.stringify({ 
      error: 'Erreur serveur interne', 
      message: error.message,
      timestamp: new Date()
    }));
  }
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} déjà utilisé. Essayez: taskkill /f /im node.exe`);
  } else {
    console.error('❌ Erreur serveur:', error);
  }
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`
🎉 BAM API Phase 2 - Serveur Robuste Démarré
🚀 Écoute sur: http://localhost:${PORT}
📅 Démarré à: ${new Date().toLocaleString()}
📊 PID: ${process.pid}

✅ ENDPOINTS FONCTIONNELS:
   🩺 GET /health - Health check
   📊 GET / - Informations API  
   🔐 POST /auth/register - Inscription
   🛡️ POST /reports - Signalement
   📈 GET /reports/stats - Stats signalement
   🏆 GET /gamification/profile - Profil gamification
   🏅 GET /gamification/badges - Badges disponibles
   ➕ POST /gamification/points/add - Ajouter points
   📍 POST /location/record - Enregistrer position
   📊 GET /location/stats - Stats géolocalisation
   🎯 POST /location/zones - Zone favorite
   🏢 GET /admin/dashboard/stats - Dashboard admin
   🔌 GET /websocket/stats - Stats WebSocket

🎯 PRÊT POUR LES TESTS POSTMAN ET AUTOMATISÉS !
  `);
});

// Gestion propre de l'arrêt
process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt du serveur...');
  server.close(() => {
    console.log('✅ Serveur arrêté proprement');
    process.exit(0);
  });
});

process.on('uncaughtException', (error) => {
  console.error('❌ Exception non gérée:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesse rejetée non gérée:', reason);
  process.exit(1);
});