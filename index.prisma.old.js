const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Import configuration et middlewares
const { config, validateConfig } = require('./config');
const { errorHandler, notFoundHandler, requestLogger } = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiting');
const webSocketService = require('./services/webSocketService');

// Validation de la configuration au démarrage
try {
  validateConfig();
} catch (error) {
  console.error('❌ Erreur de configuration:', error.message);
  process.exit(1);
}

const app = express();
const PORT = config.server.port;

// Middlewares de sécurité
app.use(helmet()); // Sécurisation des headers HTTP
app.use(cors(config.cors));
app.use(generalLimiter); // Rate limiting général
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging des requêtes
if (config.server.env === 'development') {
  app.use(requestLogger);
}

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const bamRoutes = require('./routes/bams');
const callRoutes = require('./routes/calls');
const reviewRoutes = require('./routes/reviews');
const notificationRoutes = require('./routes/notifications');
const websocketRoutes = require('./routes/websocket');
const uploadRoutes = require('./routes/uploads');
const gamificationRoutes = require('./routes/gamification');
const reportingRoutes = require('./routes/reporting');
const locationRoutes = require('./routes/location');
const adminRoutes = require('./routes/admin');
const adminDashboardRoutes = require('./routes/adminDashboard');

// Routes publiques (pas d'authentification requise)
app.use('/auth', authRoutes);

// Routes protégées
app.use('/users', userRoutes);
app.use('/bams', bamRoutes);
app.use('/calls', callRoutes);
app.use('/reviews', reviewRoutes);
app.use('/notifications', notificationRoutes);
app.use('/websocket', websocketRoutes);
app.use('/uploads', uploadRoutes);
app.use('/gamification', gamificationRoutes);
app.use('/reports', reportingRoutes);
app.use('/location', locationRoutes);
app.use('/admin/auto-moderation', adminRoutes);
app.use('/admin', adminDashboardRoutes);

// Route de santé
app.get('/', (req, res) => {
  res.json({
    message: '🧭 BAM API is running',
    version: '1.0.0',
    environment: config.server.env,
    timestamp: new Date().toISOString(),
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Middleware de gestion des erreurs (doit être en dernier)
app.use(notFoundHandler);
app.use(errorHandler);

// Gestion propre de l'arrêt du serveur
process.on('SIGTERM', () => {
  console.log('🛑 Arrêt du serveur...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('� Arrêt du serveur...');
  process.exit(0);
});

// Créer le serveur HTTP
const server = http.createServer(app);

// Initialiser les WebSockets
webSocketService.initialize(server);

// Ajouter les WebSockets à l'app pour accès dans les routes
app.set('webSocketService', webSocketService);

// Injecter le WebSocketService dans les services qui en ont besoin
const ReportingService = require('./services/reportingService');
const reportingService = new ReportingService();
reportingService.setWebSocketService(webSocketService);

const advancedLocationService = require('./services/advancedLocationService');
advancedLocationService.setWebSocketService(webSocketService);

server.listen(PORT, () => {
  console.log(`🚀 BAM API running on http://localhost:${PORT}`);
  console.log(`📋 Environment: ${config.server.env}`);
  console.log(`🗄️  Database: ${config.database.url ? 'Connected' : 'Not configured'}`);
  console.log(`🔌 WebSocket service: Ready`);
});
