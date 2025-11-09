#!/bin/bash

# Script de déploiement Heroku pour BAM API Phase 2

echo "🚀 Déploiement BAM API Phase 2 sur Heroku"
echo "=========================================="

# Vérifications préliminaires
echo "📋 Vérifications..."

if ! command -v heroku &> /dev/null; then
    echo "❌ Heroku CLI non installé. Installez-le depuis: https://devcenter.heroku.com/articles/heroku-cli"
    exit 1
fi

if ! command -v git &> /dev/null; then
    echo "❌ Git non installé"
    exit 1
fi

echo "✅ Prérequis OK"

# Configuration
read -p "Nom de votre app Heroku (ex: bam-api-prod): " APP_NAME
read -p "Votre secret JWT (32+ caractères): " JWT_SECRET

echo "🏗️  Création de l'application Heroku..."

# Création de l'app
heroku create $APP_NAME

# Ajout de PostgreSQL
echo "📦 Ajout de PostgreSQL..."
heroku addons:create heroku-postgresql:mini --app $APP_NAME

# Configuration des variables d'environnement
echo "⚙️  Configuration des variables..."
heroku config:set NODE_ENV=production --app $APP_NAME
heroku config:set JWT_SECRET="$JWT_SECRET" --app $APP_NAME
heroku config:set JWT_EXPIRES_IN=24h --app $APP_NAME

# Déploiement
echo "🚢 Déploiement du code..."
git add .
git commit -m "Deploy BAM API Phase 2 to Heroku"
git push heroku main

# Migration de la base de données
echo "🗄️  Migration de la base de données..."
heroku run npm run prisma:deploy --app $APP_NAME

# Tests post-déploiement
echo "🧪 Tests de déploiement..."
APP_URL="https://$APP_NAME.herokuapp.com"
echo "Testing health endpoint..."

HEALTH_RESPONSE=$(curl -s "$APP_URL/health")
if [[ $HEALTH_RESPONSE == *"OK"* ]]; then
    echo "✅ Health check: OK"
else
    echo "❌ Health check: FAILED"
    echo "Response: $HEALTH_RESPONSE"
fi

echo ""
echo "🎉 Déploiement terminé !"
echo "📍 URL de votre API: $APP_URL"
echo "🔍 Logs: heroku logs --tail --app $APP_NAME"
echo "⚙️  Config: heroku config --app $APP_NAME"
echo ""
echo "🧪 Testez vos endpoints:"
echo "  Health: $APP_URL/health"
echo "  API Info: $APP_URL/"
echo "  Gamification: $APP_URL/gamification/profile"
echo ""
echo "📋 Collection Postman: Changez baseUrl vers $APP_URL"