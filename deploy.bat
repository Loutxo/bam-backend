@echo off
REM Script de déploiement BAM Backend pour Windows
REM Version PowerShell du script de déploiement

echo 🚀 Déploiement BAM Backend en production...

REM Vérifications préalables
echo 🔍 Vérifications préalables...

where node >nul 2>nul
if errorlevel 1 (
    echo ❌ Node.js n'est pas installé
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo ❌ npm n'est pas installé
    exit /b 1
)

echo ✅ Prérequis OK

REM Vérifier le fichier .env
if not exist .env (
    echo ❌ Fichier .env manquant. Copiez .env.production vers .env et configurez-le.
    exit /b 1
)

echo ✅ Configuration OK

REM Installation des dépendances
echo 📦 Installation des dépendances...
call npm ci --only=production

REM Tests avant déploiement
echo 🧪 Exécution des tests...
set NODE_ENV=test
call npm test

if errorlevel 1 (
    echo ❌ Tests échoués, déploiement annulé
    exit /b 1
)

echo ✅ Tests OK

REM Génération du client Prisma
echo 🗄️ Génération du client Prisma...
call npx prisma generate

REM Migration de la base de données
echo 🗄️ Migration de la base de données...
call npx prisma migrate deploy

if errorlevel 1 (
    echo ❌ Migration échouée, déploiement annulé
    exit /b 1
)

echo ✅ Base de données OK

echo 🎉 Déploiement prêt!
echo 📋 Pour démarrer l'application: npm start
echo 🌐 L'API sera accessible sur http://localhost:3000
echo 🏥 Health check disponible sur: http://localhost:3000/health

pause