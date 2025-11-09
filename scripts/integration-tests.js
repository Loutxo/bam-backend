#!/usr/bin/env node

const { spawn } = require('child_process');

console.log('🚀 BAM Backend - Démarrage des tests d\'intégration\n');

// Configuration
const config = {
  port: process.env.PORT || 3000,
  nodeEnv: 'test',
  testTimeout: 30000, // 30 secondes
};

console.log('📋 Configuration:');
console.log(`   - Port: ${config.port}`);
console.log(`   - Environment: ${config.nodeEnv}`);
console.log(`   - Timeout: ${config.testTimeout}ms\n`);

// Fonction pour attendre que le serveur soit prêt
function waitForServer(port, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    function checkServer() {
      const http = require('http');
      const req = http.request({
        hostname: 'localhost',
        port: port,
        path: '/health',
        method: 'GET',
        timeout: 1000,
      }, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          setTimeout(checkServer, 1000);
        }
      });

      req.on('error', () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Serveur non accessible après ${timeout}ms`));
        } else {
          setTimeout(checkServer, 1000);
        }
      });

      req.end();
    }

    checkServer();
  });
}

// Fonction principale
async function runIntegrationTests() {
  let serverProcess;

  try {
    console.log('🌟 Démarrage du serveur de test...');

    // Démarrer le serveur en arrière-plan
    serverProcess = spawn('node', ['index.js'], {
      env: {
        ...process.env,
        NODE_ENV: config.nodeEnv,
        PORT: config.port,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    serverProcess.stdout.on('data', (data) => {
      console.log(`📡 Server: ${data.toString().trim()}`);
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`❌ Server Error: ${data.toString().trim()}`);
    });

    // Attendre que le serveur soit prêt
    console.log('⏳ Attente du serveur...');
    await waitForServer(config.port, config.testTimeout);
    console.log('✅ Serveur prêt!\n');

    // Lancer les tests Jest d'intégration
    console.log('🧪 Lancement des tests Jest...');
    const isWindows = process.platform === 'win32';
    const jestCommand = isWindows ? 'npx.cmd' : 'npx';
    const jestProcess = spawn(jestCommand, ['jest', '--testMatch=**/tests/**/*.integration.test.js', '--verbose'], {
      stdio: 'inherit',
      cwd: process.cwd(),
      shell: isWindows,
    });

    await new Promise((resolve, reject) => {
      jestProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Tests Jest terminés avec succès!\n');
          resolve();
        } else {
          reject(new Error(`Tests Jest échoués avec le code ${code}`));
        }
      });
    });

    // Instructions pour les tests Postman
    console.log('📮 Instructions pour les tests Postman:');
    console.log('   1. Ouvrir Postman');
    console.log('   2. Importer les collections depuis le dossier postman/');
    console.log('   3. Sélectionner l\'environnement "BAM Backend - Local Development"');
    console.log('   4. Exécuter les collections dans l\'ordre:');
    console.log('      - BAM Backend - Authentication');
    console.log('      - BAM Backend - BAMs');
    console.log('      - BAM Backend - Users');
    console.log('      - BAM Backend - Calls');
    console.log('      - BAM Backend - Reviews\n');

    console.log('🎉 Tests d\'intégration terminés avec succès!');

  } catch (error) {
    console.error(`❌ Erreur: ${error.message}`);
    process.exit(1);
  } finally {
    // Arrêter le serveur
    if (serverProcess) {
      console.log('🛑 Arrêt du serveur...');
      serverProcess.kill('SIGTERM');

      // Forcer l'arrêt après 5 secondes si nécessaire
      setTimeout(() => {
        serverProcess.kill('SIGKILL');
      }, 5000);
    }
  }
}

// Gestion des signaux pour un arrêt propre
process.on('SIGINT', () => {
  console.log('\n🛑 Arrêt forcé détecté, nettoyage...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Arrêt demandé, nettoyage...');
  process.exit(0);
});

// Lancer les tests
runIntegrationTests().catch((error) => {
  console.error(`❌ Erreur fatale: ${error.message}`);
  process.exit(1);
});
