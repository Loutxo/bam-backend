# Script de déploiement pour BAM Backend
# Ce script automatise le déploiement en production

#!/bin/bash

echo "🚀 Déploiement BAM Backend en production..."

# Vérifications préalables
echo "🔍 Vérifications préalables..."

# Vérifier que Node.js est installé
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé"
    exit 1
fi

# Vérifier que npm est installé
if ! command -v npm &> /dev/null; then
    echo "❌ npm n'est pas installé"
    exit 1
fi

# Vérifier que PostgreSQL est accessible
if ! command -v psql &> /dev/null; then
    echo "⚠️ PostgreSQL CLI non trouvé, assurez-vous que la DB est accessible"
fi

echo "✅ Prérequis OK"

# Configuration de l'environnement
echo "⚙️ Configuration de l'environnement..."

if [ ! -f .env ]; then
    echo "❌ Fichier .env manquant. Copiez .env.production vers .env et configurez-le."
    exit 1
fi

# Source the environment variables
set -a
source .env
set +a

if [ "$NODE_ENV" != "production" ]; then
    echo "❌ NODE_ENV doit être défini sur 'production' dans .env"
    exit 1
fi

echo "✅ Configuration OK"

# Installation des dépendances
echo "📦 Installation des dépendances..."
npm ci --only=production

# Tests avant déploiement
echo "🧪 Exécution des tests..."
NODE_ENV=test npm test

if [ $? -ne 0 ]; then
    echo "❌ Tests échoués, déploiement annulé"
    exit 1
fi

echo "✅ Tests OK"

# Génération du client Prisma
echo "🗄️ Génération du client Prisma..."
npx prisma generate

# Migration de la base de données
echo "🗄️ Migration de la base de données..."
npx prisma migrate deploy

if [ $? -ne 0 ]; then
    echo "❌ Migration échouée, déploiement annulé"
    exit 1
fi

echo "✅ Base de données OK"

# Vérification de la santé de l'application
echo "🏥 Test de santé de l'application..."

# Démarrer l'application en arrière-plan
npm start &
APP_PID=$!

# Attendre que l'application démarre
sleep 10

# Tester l'endpoint de santé
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/health)

if [ "$HEALTH_CHECK" = "200" ]; then
    echo "✅ Application démarrée avec succès"
    echo "🌐 API accessible sur http://localhost:$PORT"
    echo "🏥 Health check: http://localhost:$PORT/health"
    echo ""
    echo "🎉 Déploiement terminé avec succès!"
    echo ""
    echo "📋 Étapes suivantes recommandées:"
    echo "   1. Configurer un reverse proxy (nginx/Apache)"
    echo "   2. Configurer un gestionnaire de processus (PM2)"
    echo "   3. Configurer le monitoring et les logs"
    echo "   4. Configurer les sauvegardes de base de données"
    echo ""
    echo "🔧 Commandes utiles:"
    echo "   - Arrêter l'application: kill $APP_PID"
    echo "   - Voir les logs: tail -f logs/app.log"
    echo "   - Redémarrer: npm start"
    
    # Ne pas tuer le processus, laisser l'app tourner
    # kill $APP_PID
else
    echo "❌ Health check échoué (HTTP $HEALTH_CHECK)"
    kill $APP_PID
    exit 1
fi