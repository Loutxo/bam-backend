@echo off
REM Script de déploiement Heroku pour Windows - BAM API Phase 2

echo 🚀 Déploiement BAM API Phase 2 sur Heroku
echo ==========================================

REM Vérifications préliminaires
echo 📋 Vérifications...

where heroku >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ Heroku CLI non installé. Installez-le depuis: https://devcenter.heroku.com/articles/heroku-cli
    pause
    exit /b 1
)

where git >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ❌ Git non installé
    pause
    exit /b 1
)

echo ✅ Prérequis OK

REM Configuration
set /p APP_NAME="Nom de votre app Heroku (ex: bam-api-prod): "
set /p JWT_SECRET="Votre secret JWT (32+ caractères): "

echo 🏗️ Création de l'application Heroku...

REM Création de l'app
heroku create %APP_NAME%

REM Ajout de PostgreSQL
echo 📦 Ajout de PostgreSQL...
heroku addons:create heroku-postgresql:mini --app %APP_NAME%

REM Configuration des variables d'environnement
echo ⚙️ Configuration des variables...
heroku config:set NODE_ENV=production --app %APP_NAME%
heroku config:set JWT_SECRET="%JWT_SECRET%" --app %APP_NAME%
heroku config:set JWT_EXPIRES_IN=24h --app %APP_NAME%

REM Déploiement
echo 🚢 Déploiement du code...
git add .
git commit -m "Deploy BAM API Phase 2 to Heroku"
git push heroku main

REM Migration de la base de données
echo 🗄️ Migration de la base de données...
heroku run npm run prisma:deploy --app %APP_NAME%

echo.
echo 🎉 Déploiement terminé !
echo 📍 URL de votre API: https://%APP_NAME%.herokuapp.com
echo 🔍 Logs: heroku logs --tail --app %APP_NAME%
echo ⚙️ Config: heroku config --app %APP_NAME%
echo.
echo 🧪 Testez vos endpoints:
echo   Health: https://%APP_NAME%.herokuapp.com/health
echo   API Info: https://%APP_NAME%.herokuapp.com/
echo   Gamification: https://%APP_NAME%.herokuapp.com/gamification/profile
echo.
echo 📋 Collection Postman: Changez baseUrl vers https://%APP_NAME%.herokuapp.com

pause