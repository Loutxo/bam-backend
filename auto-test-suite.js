/**
 * Script de test automatisé complet pour l'API BAM Phase 2
 * Teste toutes les fonctionnalités via des requêtes HTTP
 */

const https = require('https');
const http = require('http');

const BASE_URL = 'http://localhost:3000';
let results = {
  passed: 0,
  failed: 0,
  tests: []
};

// Fonction utilitaire pour faire des requêtes HTTP
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'BAM-API-Test-Suite/1.0'
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve({
            status: res.statusCode,
            data: parsedData,
            headers: res.headers
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            data: responseData,
            headers: res.headers
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Fonction de test avec assertion
async function runTest(name, testFn) {
  try {
    console.log(`\n🧪 Test: ${name}`);
    const result = await testFn();
    
    if (result.success) {
      console.log(`✅ PASS: ${result.message}`);
      results.passed++;
    } else {
      console.log(`❌ FAIL: ${result.message}`);
      results.failed++;
    }
    
    results.tests.push({
      name,
      passed: result.success,
      message: result.message,
      data: result.data
    });
    
  } catch (error) {
    console.log(`❌ ERROR: ${name} - ${error.message}`);
    results.failed++;
    results.tests.push({
      name,
      passed: false,
      message: error.message,
      error: true
    });
  }
}

// Tests individuels
async function testHealthCheck() {
  const response = await makeRequest('GET', '/health');
  
  return {
    success: response.status === 200 && response.data.status === 'OK',
    message: `Health check returned status ${response.status}`,
    data: response.data
  };
}

async function testApiInfo() {
  const response = await makeRequest('GET', '/');
  
  return {
    success: response.status === 200 && response.data.version === '2.0.0',
    message: `API info returned version ${response.data.version}`,
    data: response.data
  };
}

async function testUserRegistration() {
  const userData = {
    pseudo: "TestUser",
    email: "test@example.com",
    password: "password123"
  };
  
  const response = await makeRequest('POST', '/auth/register', userData);
  
  return {
    success: response.status === 201 && response.data.success === true,
    message: `User registration returned status ${response.status}`,
    data: response.data
  };
}

async function testCreateReport() {
  const reportData = {
    type: "INAPPROPRIATE_CONTENT",
    reason: "Test de signalement automatisé",
    targetId: "test_target_auto"
  };
  
  const response = await makeRequest('POST', '/reports', reportData);
  
  return {
    success: response.status === 201 && response.data.success === true,
    message: `Report creation returned status ${response.status}`,
    data: response.data
  };
}

async function testReportStats() {
  const response = await makeRequest('GET', '/reports/stats');
  
  return {
    success: response.status === 200 && response.data.data.totalReports >= 0,
    message: `Report stats returned ${response.data.data.totalReports} total reports`,
    data: response.data
  };
}

async function testGamificationProfile() {
  const response = await makeRequest('GET', '/gamification/profile');
  
  return {
    success: response.status === 200 && response.data.data.totalPoints >= 0,
    message: `Gamification profile shows ${response.data.data.totalPoints} total points`,
    data: response.data
  };
}

async function testGamificationBadges() {
  const response = await makeRequest('GET', '/gamification/badges');
  
  return {
    success: response.status === 200 && Array.isArray(response.data.data),
    message: `Found ${response.data.data.length} available badges`,
    data: response.data
  };
}

async function testAddPoints() {
  const pointsData = {
    points: 25,
    reason: "Test automatisé",
    category: "ENGAGEMENT"
  };
  
  const response = await makeRequest('POST', '/gamification/points/add', pointsData);
  
  return {
    success: response.status === 200 && response.data.success === true,
    message: `Added ${response.data.data.pointsAdded} points successfully`,
    data: response.data
  };
}

async function testRecordLocation() {
  const locationData = {
    latitude: 48.8566,
    longitude: 2.3522,
    accuracy: 10,
    address: "Paris, France"
  };
  
  const response = await makeRequest('POST', '/location/record', locationData);
  
  return {
    success: response.status === 201 && response.data.success === true,
    message: `Location recorded at ${response.data.data.latitude}, ${response.data.data.longitude}`,
    data: response.data
  };
}

async function testLocationStats() {
  const response = await makeRequest('GET', '/location/stats');
  
  return {
    success: response.status === 200 && response.data.data.totalLocations >= 0,
    message: `Location stats show ${response.data.data.totalLocations} total locations`,
    data: response.data
  };
}

async function testCreateFavoriteZone() {
  const zoneData = {
    name: "Zone Test Auto",
    latitude: 48.8566,
    longitude: 2.3522,
    radius: 500,
    color: "#3B82F6"
  };
  
  const response = await makeRequest('POST', '/location/zones', zoneData);
  
  return {
    success: response.status === 201 && response.data.success === true,
    message: `Created favorite zone "${response.data.data.name}"`,
    data: response.data
  };
}

async function testAdminDashboard() {
  const response = await makeRequest('GET', '/admin/dashboard/stats');
  
  return {
    success: response.status === 200 && response.data.data.overview.totalUsers >= 0,
    message: `Admin dashboard shows ${response.data.data.overview.totalUsers} total users`,
    data: response.data
  };
}

async function testWebSocketStats() {
  const response = await makeRequest('GET', '/websocket/stats');
  
  return {
    success: response.status === 200 && response.data.data.connectedUsers >= 0,
    message: `WebSocket shows ${response.data.data.connectedUsers} connected users`,
    data: response.data
  };
}

// Fonction principale de test
async function runAllTests() {
  console.log('🚀 BAM API Phase 2 - Test Suite Automatisé');
  console.log('='.repeat(50));
  
  const startTime = Date.now();
  
  // Tests de base
  await runTest('Health Check', testHealthCheck);
  await runTest('API Info', testApiInfo);
  
  // Tests d'authentification
  await runTest('User Registration', testUserRegistration);
  
  // Tests de signalement
  await runTest('Create Report', testCreateReport);
  await runTest('Report Stats', testReportStats);
  
  // Tests de gamification
  await runTest('Gamification Profile', testGamificationProfile);
  await runTest('Available Badges', testGamificationBadges);
  await runTest('Add Points', testAddPoints);
  
  // Tests de géolocalisation
  await runTest('Record Location', testRecordLocation);
  await runTest('Location Stats', testLocationStats);
  await runTest('Create Favorite Zone', testCreateFavoriteZone);
  
  // Tests admin
  await runTest('Admin Dashboard', testAdminDashboard);
  
  // Tests WebSocket
  await runTest('WebSocket Stats', testWebSocketStats);
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  // Rapport final
  console.log('\n' + '='.repeat(50));
  console.log('📊 RÉSULTATS DES TESTS');
  console.log('='.repeat(50));
  console.log(`⏱️  Durée: ${duration}s`);
  console.log(`✅ Tests réussis: ${results.passed}`);
  console.log(`❌ Tests échoués: ${results.failed}`);
  console.log(`📈 Taux de réussite: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
  
  // Détails des échecs
  if (results.failed > 0) {
    console.log('\n🔍 DÉTAILS DES ÉCHECS:');
    results.tests
      .filter(test => !test.passed)
      .forEach(test => {
        console.log(`❌ ${test.name}: ${test.message}`);
      });
  }
  
  // Résumé des fonctionnalités testées
  console.log('\n✅ FONCTIONNALITÉS TESTÉES:');
  console.log('• 🩺 Health Check & API Info');
  console.log('• 🔐 Système d\'authentification');
  console.log('• 🛡️ Signalement et modération');
  console.log('• 🏆 Gamification complète (points, badges)');
  console.log('• 📍 Géolocalisation avancée (positions, zones)');
  console.log('• 🏢 Dashboard administrateur');
  console.log('• 🔌 WebSocket et temps réel');
  
  console.log('\n🎉 Phase 2 BAM API - Tests terminés !');
  
  return results;
}

// Lancement des tests si le script est exécuté directement
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { runAllTests, makeRequest };