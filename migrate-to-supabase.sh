#!/bin/bash

# Script de migration BAM API vers Supabase + Vercel
echo "🚀 Migration BAM API vers Supabase + Vercel"
echo "==========================================="

# Vérifications préliminaires
echo "📋 Vérifications des outils..."

if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI non installé. Installation..."
    npm install -g vercel
fi

if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI non installé. Installation..."
    npm install -g supabase
fi

echo "✅ Outils OK"

# Configuration Supabase
echo ""
echo "📝 Configuration Supabase"
echo "Allez sur https://supabase.com et créez un nouveau projet"
echo "Choisissez la région Europe West (eu-west-1) pour de meilleures performances"
echo ""

read -p "Entrez votre Project Reference (dans l'URL Supabase): " SUPABASE_REF
read -p "Entrez votre Database Password: " SUPABASE_PASSWORD
read -s -p "Entrez votre Anon Key: " SUPABASE_ANON_KEY
echo ""
read -s -p "Entrez votre Service Role Key: " SUPABASE_SERVICE_KEY
echo ""

# Configuration des variables
DATABASE_URL="postgresql://postgres:$SUPABASE_PASSWORD@db.$SUPABASE_REF.supabase.co:5432/postgres"
SUPABASE_URL="https://$SUPABASE_REF.supabase.co"

echo "🗄️ Configuration de la base de données..."

# Génération du script de migration
echo "📝 Génération du script de migration..."
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > migration.sql

echo "✅ Script de migration généré: migration.sql"
echo ""
echo "⚠️  Action manuelle requise:"
echo "1. Ouvrez Supabase Dashboard > SQL Editor"
echo "2. Copiez le contenu de migration.sql"
echo "3. Exécutez le script SQL"
echo "4. Activez les extensions PostGIS pour la géolocalisation:"
echo "   CREATE EXTENSION IF NOT EXISTS \"postgis\";"
echo ""
read -p "Appuyez sur Entrée après avoir terminé la configuration Supabase..."

# Configuration Vercel
echo ""
echo "🚀 Configuration Vercel..."

# Login si nécessaire
vercel login

# Déploiement initial
echo "📦 Premier déploiement..."
vercel

# Récupération de l'URL du projet
VERCEL_URL=$(vercel --scope $(vercel whoami --json | jq -r '.username') ls | grep -E "bam|api" | head -1 | awk '{print $2}')

if [ -z "$VERCEL_URL" ]; then
    read -p "Entrez l'URL de votre projet Vercel (ex: bam-api-xyz.vercel.app): " VERCEL_URL
fi

echo "🔧 Configuration des variables d'environnement..."

# Configuration des variables d'environnement
echo "$DATABASE_URL" | vercel env add DATABASE_URL production
echo "$SUPABASE_URL" | vercel env add SUPABASE_URL production  
echo "$SUPABASE_ANON_KEY" | vercel env add SUPABASE_ANON_KEY production
echo "$SUPABASE_SERVICE_KEY" | vercel env add SUPABASE_SERVICE_KEY production
echo "production" | vercel env add NODE_ENV production

# JWT Secret
read -p "Entrez votre JWT Secret (32+ caractères): " JWT_SECRET
echo "$JWT_SECRET" | vercel env add JWT_SECRET production

# Déploiement final
echo "🚢 Déploiement production..."
vercel --prod

echo ""
echo "🎉 Migration terminée !"
echo "================================="
echo "📍 URL API: https://$VERCEL_URL"
echo "🗄️ Dashboard Supabase: https://app.supabase.com/project/$SUPABASE_REF"
echo "⚙️ Dashboard Vercel: https://vercel.com/dashboard"
echo ""
echo "🧪 Tests à effectuer:"
echo "  Health Check: https://$VERCEL_URL/health"
echo "  API Info: https://$VERCEL_URL/"
echo "  Gamification: https://$VERCEL_URL/gamification/profile"
echo ""
echo "📋 Collection Postman:"
echo "  Changez baseUrl vers: https://$VERCEL_URL"
echo ""
echo "🔍 Logs en temps réel:"
echo "  vercel logs --follow"