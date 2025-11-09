@echo off
REM Script de migration BAM API vers Supabase + Vercel (Windows)

echo 🚀 Migration BAM API vers Supabase + Vercel
echo ===========================================

REM Vérifications préliminaires
echo 📋 Vérifications des outils...

where vercel >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ Vercel CLI non installé. Installation...
    npm install -g vercel
)

where supabase >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ Supabase CLI non installé. Installation...
    npm install -g supabase
)

echo ✅ Outils OK

REM Configuration Supabase
echo.
echo 📝 Configuration Supabase
echo Allez sur https://supabase.com et créez un nouveau projet
echo Choisissez la région Europe West (eu-west-1) pour de meilleures performances
echo.

set /p SUPABASE_REF="Entrez votre Project Reference (dans l'URL Supabase): "
set /p SUPABASE_PASSWORD="Entrez votre Database Password: "
set /p SUPABASE_ANON_KEY="Entrez votre Anon Key: "
set /p SUPABASE_SERVICE_KEY="Entrez votre Service Role Key: "

REM Configuration des variables
set DATABASE_URL=postgresql://postgres:%SUPABASE_PASSWORD%@db.%SUPABASE_REF%.supabase.co:5432/postgres
set SUPABASE_URL=https://%SUPABASE_REF%.supabase.co

echo 🗄️ Configuration de la base de données...

REM Génération du script de migration
echo 📝 Génération du script de migration...
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > migration.sql

echo ✅ Script de migration généré: migration.sql
echo.
echo ⚠️ Action manuelle requise:
echo 1. Ouvrez Supabase Dashboard ^> SQL Editor
echo 2. Copiez le contenu de migration.sql
echo 3. Exécutez le script SQL
echo 4. Activez les extensions PostGIS pour la géolocalisation:
echo    CREATE EXTENSION IF NOT EXISTS "postgis";
echo.
pause

REM Configuration Vercel
echo.
echo 🚀 Configuration Vercel...

REM Login si nécessaire
vercel login

REM Déploiement initial
echo 📦 Premier déploiement...
vercel

set /p VERCEL_URL="Entrez l'URL de votre projet Vercel (ex: bam-api-xyz.vercel.app): "

echo 🔧 Configuration des variables d'environnement...

REM Configuration des variables d'environnement
echo %DATABASE_URL% | vercel env add DATABASE_URL production
echo %SUPABASE_URL% | vercel env add SUPABASE_URL production
echo %SUPABASE_ANON_KEY% | vercel env add SUPABASE_ANON_KEY production
echo %SUPABASE_SERVICE_KEY% | vercel env add SUPABASE_SERVICE_KEY production
echo production | vercel env add NODE_ENV production

REM JWT Secret
set /p JWT_SECRET="Entrez votre JWT Secret (32+ caractères): "
echo %JWT_SECRET% | vercel env add JWT_SECRET production

REM Déploiement final
echo 🚢 Déploiement production...
vercel --prod

echo.
echo 🎉 Migration terminée !
echo =================================
echo 📍 URL API: https://%VERCEL_URL%
echo 🗄️ Dashboard Supabase: https://app.supabase.com/project/%SUPABASE_REF%
echo ⚙️ Dashboard Vercel: https://vercel.com/dashboard
echo.
echo 🧪 Tests à effectuer:
echo   Health Check: https://%VERCEL_URL%/health
echo   API Info: https://%VERCEL_URL%/
echo   Gamification: https://%VERCEL_URL%/gamification/profile
echo.
echo 📋 Collection Postman:
echo   Changez baseUrl vers: https://%VERCEL_URL%
echo.
echo 🔍 Logs en temps réel:
echo   vercel logs --follow

pause