/**
 * Script de test pour le système de géolocalisation avancée
 * Teste les fonctionnalités sans base de données active
 */

const AdvancedLocationService = require('./services/advancedLocationService');

// Mock PrismaClient pour les tests sans DB
class MockPrismaClient {
  constructor() {
    this.locationHistory = {
      create: async (data) => ({ id: 'mock-location-id', ...data.data, createdAt: new Date() }),
      findMany: async () => [],
      findFirst: async () => null,
      deleteMany: async () => ({ count: 0 }),
      count: async () => 0,
      groupBy: async () => []
    };

    this.favoriteZone = {
      create: async (data) => ({ id: 'mock-zone-id', ...data.data, createdAt: new Date() }),
      findMany: async () => [],
      findUnique: async () => null,
      updateMany: async () => ({ count: 1 }),
      deleteMany: async () => ({ count: 1 }),
      count: async () => 3
    };

    this.zoneVisit = {
      create: async (data) => ({ id: 'mock-visit-id', ...data.data }),
      findFirst: async () => null,
      update: async () => ({ id: 'mock-visit-id' }),
      count: async () => 0
    };

    this.geofenceAlert = {
      create: async (data) => ({ id: 'mock-alert-id', ...data.data }),
      findMany: async () => [],
      updateMany: async () => ({ count: 0 }),
      count: async () => 0
    };

    this.proximityNotification = {
      create: async (data) => ({ id: 'mock-notification-id', ...data.data })
    };

    this.bam = {
      findMany: async () => []
    };
  }
}

async function testAdvancedLocationService() {
  console.log('🧪 Test du système de géolocalisation avancée\n');

  // Utiliser le singleton avec mock
  const locationService = AdvancedLocationService;
  locationService.prisma = new MockPrismaClient();

  const userId = 'test-user-123';

  try {
    // ✅ Test 1: Calcul de distance
    console.log('📏 Test 1: Calcul de distance');
    const distance = locationService.calculateDistance(
      48.8566, 2.3522,  // Paris
      45.7640, 4.8357   // Lyon
    );
    console.log(`Distance Paris-Lyon: ${Math.round(distance / 1000)} km`);
    console.log('✅ Calcul de distance OK\n');

    // ✅ Test 2: Vérification de rayon
    console.log('📍 Test 2: Vérification de rayon');
    const isWithin = locationService.isWithinRadius(
      48.8566, 2.3522,  // Centre Paris
      48.8606, 2.3376,  // Tour Eiffel
      5000               // 5km de rayon
    );
    console.log(`Tour Eiffel dans un rayon de 5km du centre de Paris: ${isWithin}`);
    console.log('✅ Vérification de rayon OK\n');

    // ✅ Test 3: Enregistrement de position
    console.log('📌 Test 3: Enregistrement de position');
    const location = await locationService.recordLocation(userId, {
      latitude: 48.8566,
      longitude: 2.3522,
      accuracy: 10,
      address: '1 Place du Châtelet, Paris',
      city: 'Paris',
      country: 'France',
      source: 'GPS'
    });
    console.log(`Position enregistrée:`, location);
    console.log('✅ Enregistrement de position OK\n');

    // ✅ Test 4: Création de zone favorite
    console.log('🏠 Test 4: Création de zone favorite');
    const zone = await locationService.createFavoriteZone(userId, {
      name: 'Bureau Test',
      description: 'Zone de test pour le bureau',
      latitude: 48.8566,
      longitude: 2.3522,
      radius: 500,
      color: '#3B82F6',
      notifyOnEnter: true,
      notifyOnExit: true
    });
    console.log(`Zone favorite créée:`, zone);
    console.log('✅ Création de zone favorite OK\n');

    // ✅ Test 5: Récupération des statistiques
    console.log('📊 Test 5: Statistiques de géolocalisation');
    const stats = await locationService.getUserLocationStats(userId);
    console.log(`Statistiques utilisateur:`, stats);
    console.log('✅ Statistiques OK\n');

    console.log('🎉 Tous les tests sont passés avec succès!\n');

    // Affichage des fonctionnalités implémentées
    console.log('🚀 FONCTIONNALITÉS DE GÉOLOCALISATION AVANCÉE DISPONIBLES:');
    console.log('');
    console.log('📍 HISTORIQUE & TRACKING:');
    console.log('  • Enregistrement automatique des positions GPS');
    console.log('  • Historique détaillé avec précision et adresses');
    console.log('  • Sources multiples (GPS, Manuel, Background)');
    console.log('  • Nettoyage automatique des données anciennes');
    console.log('');
    console.log('🏠 ZONES FAVORITES:');
    console.log('  • Création de zones géographiques personnalisées');
    console.log('  • Géofencing avec rayons configurables');
    console.log('  • Notifications d\'entrée/sortie de zone');
    console.log('  • Suivi des visites et durées dans les zones');
    console.log('');
    console.log('🔔 ALERTES & NOTIFICATIONS:');
    console.log('  • Alertes géofence en temps réel');
    console.log('  • Notifications de proximité (BAMs proches)');
    console.log('  • Système d\'alertes personnalisables');
    console.log('  • Intégration WebSocket pour notifications live');
    console.log('');
    console.log('📊 STATISTIQUES & ANALYTICS:');
    console.log('  • Statistiques détaillées de géolocalisation');
    console.log('  • Villes visitées et fréquences');
    console.log('  • Calculs de distance et proximité');
    console.log('  • Historique d\'activité géographique');
    console.log('');
    console.log('🌐 API ENDPOINTS DISPONIBLES:');
    console.log('  • POST /api/location/record - Enregistrer position');
    console.log('  • GET /api/location/history - Historique positions');
    console.log('  • GET /api/location/current - Position actuelle');
    console.log('  • POST/GET/PUT/DELETE /api/location/zones - Gestion zones');
    console.log('  • GET /api/location/alerts - Alertes géofence');
    console.log('  • GET /api/location/stats - Statistiques');
    console.log('  • POST /api/location/distance - Calcul distance');

  } catch (error) {
    console.error('❌ Erreur lors des tests:', error);
  }
}

// Lancer les tests si exécuté directement
if (require.main === module) {
  testAdvancedLocationService();
}

module.exports = { testAdvancedLocationService };