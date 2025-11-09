# BAM Backend - Guide de Test et Déploiement

## 🚀 Démarrage Rapide

### Prérequis
- Node.js 18+ 
- PostgreSQL 14+
- npm ou yarn

### Installation
```bash
# Cloner et installer
git clone <repository-url>
cd bam-backend
npm install

# Configuration de la base de données
cp .env.example .env
# Éditer .env avec vos paramètres de base de données

# Migration et seed de la base de données
npx prisma migrate dev
npm run db:seed
```

### Démarrage
```bash
# Développement
npm run dev

# Production
npm start
```

## 🔐 Système d'Authentification

### JWT Implementation
- **Access Token**: Durée de vie courte (1h par défaut)
- **Refresh Token**: Durée de vie longue (7 jours par défaut)
- **Middleware sécurisé**: Vérification automatique des tokens
- **Protection CSRF**: Headers et validation des requêtes

### Endpoints Authentification
- `POST /auth/register` - Inscription
- `POST /auth/login` - Connexion
- `POST /auth/refresh` - Renouvellement de token

### Sécurité Implémentée
- ✅ Hachage bcrypt des mots de passe
- ✅ Validation des mots de passe forts
- ✅ Rate limiting (5 tentatives/15min pour auth)
- ✅ Validation stricte des entrées (express-validator)
- ✅ Headers de sécurité (Helmet.js)
- ✅ Protection CORS configurée

## 📋 API Routes

### Authentification (Public)
- `POST /auth/register` - Créer un compte
- `POST /auth/login` - Se connecter  
- `POST /auth/refresh` - Renouveler les tokens

### Utilisateurs (Protégé)
- `GET /users/profile` - Profil utilisateur
- `PUT /users/profile` - Modifier le profil
- `GET /users/:id/stats` - Statistiques utilisateur

### BAMs (Protégé)
- `POST /bams` - Créer une BAM
- `GET /bams/nearby` - BAMs à proximité
- `GET /bams/:id` - Détails d'une BAM
- `POST /bams/:id/join` - Rejoindre une BAM
- `DELETE /bams/:id/leave` - Quitter une BAM
- `POST /bams/:id/messages` - Envoyer un message

### Appels (Protégé)
- `POST /calls` - Initier un appel
- `GET /calls` - Historique des appels
- `PUT /calls/:id` - Mettre à jour le statut

### Avis (Protégé)
- `POST /reviews` - Créer un avis
- `GET /reviews` - Lister les avis
- `PUT /reviews/:id` - Modifier un avis

## 🧪 Tests

### Tests Unitaires
```bash
# Lancer tous les tests
npm test

# Tests avec surveillance
npm run test:watch

# Tests avec couverture
npm run test:coverage

# Tests unitaires seulement
npm run test:unit
```

### Tests d'Intégration
```bash
# Tests d'intégration complets
npm run test:integration

# Tests complets (unitaire + intégration)
npm run test:all
```

### Tests Postman
1. **Collections disponibles:**
   - BAM Backend - Authentication
   - BAM Backend - BAMs
   - BAM Backend - Users
   - BAM Backend - Calls
   - BAM Backend - Reviews

2. **Environnement:** BAM Backend - Local Development

3. **Variables automatiques:**
   - `accessToken` - Extrait après login
   - `refreshToken` - Token de renouvellement
   - `userId` - ID de l'utilisateur connecté
   - `bamId` - ID de BAM pour les tests

## 🛠️ Configuration

### Variables d'Environnement
```env
# Base
NODE_ENV=development
PORT=3000

# JWT
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=1h
REFRESH_JWT_SECRET=your-refresh-secret-key-here
REFRESH_JWT_EXPIRES_IN=7d

# Sécurité
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Base de données
DATABASE_URL="postgresql://user:password@localhost:5432/bam_db"
```

### Configuration Avancée
Le fichier `config/index.js` centralise toute la configuration avec validation automatique.

## 🗄️ Base de Données

### Modèles Prisma
- **User**: Utilisateurs avec authentification
- **BAM**: Bouteilles à la mer
- **Message**: Messages dans les BAMs
- **Call**: Appels vidéo entre utilisateurs
- **Review**: Système d'avis et notation

### Migrations
```bash
# Nouvelle migration
npx prisma migrate dev --name description

# Appliquer en production
npx prisma migrate deploy

# Reset complet (développement)
npm run db:reset
```

### Seed Data
```bash
# Peupler la base avec des données de test
npm run db:seed
```

## 🚀 Déploiement

### Environnement de Production

1. **Variables d'environnement:**
```env
NODE_ENV=production
DATABASE_URL="postgresql://..."
JWT_SECRET="production-secret-very-long-and-secure"
REFRESH_JWT_SECRET="another-production-secret"
```

2. **Migration:**
```bash
npx prisma migrate deploy
```

3. **Démarrage:**
```bash
npm start
```

### Docker (Optionnel)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["npm", "start"]
```

## 📊 Monitoring et Logs

### Health Checks
- `GET /health` - Status du serveur
- `GET /` - Information de l'API

### Logs
- Requests automatiquement loggées en développement
- Erreurs capturées avec stack traces
- Middleware de logging configurable

## 🔧 Développement

### Structure du Projet
```
├── config/           # Configuration centralisée
├── middleware/       # Middlewares Express
├── prisma/          # Schéma et migrations DB
├── routes/          # Routes API
├── tests/           # Tests unitaires et intégration
├── utils/           # Utilitaires (password, validation)
├── postman/         # Collections de test Postman
└── scripts/         # Scripts d'automatisation
```

### Commandes Utiles
```bash
# Linting et formatting
npm run lint
npm run lint:fix

# Base de données
npx prisma studio      # Interface graphique
npx prisma db push     # Sync sans migration
npx prisma generate    # Régénérer le client

# Tests avec debug
DEBUG=* npm test
```

## 🛡️ Sécurité Checklist

- [x] **Authentification JWT** avec refresh tokens
- [x] **Hachage des mots de passe** (bcrypt)
- [x] **Rate limiting** sur toutes les routes
- [x] **Validation des entrées** (express-validator)
- [x] **Headers de sécurité** (Helmet.js)
- [x] **CORS** configuré
- [x] **Protection XSS** et injection
- [x] **Middleware d'autorisation** sur les routes protégées
- [x] **Gestion d'erreurs** sécurisée (pas de leak d'info)

## 📞 Support

### Logs d'Erreur Communs
1. **"JWT malformed"** → Token invalide ou corrompu
2. **"User not found"** → ID utilisateur inexistant
3. **"BAM not accessible"** → BAM privée ou inexistante
4. **"Insufficient permissions"** → Droits insuffisants

### Debug
```bash
# Logs détaillés
DEBUG=bam:* npm run dev

# Tests avec logs
DEBUG=bam:test npm test
```

---

## ✅ Statut du Projet

**Authentification:** ✅ Complète  
**Routes API:** ✅ Toutes sécurisées  
**Tests:** ✅ 21/21 tests passent  
**Documentation:** ✅ Complète  
**Sécurité:** ✅ Production-ready  

Le système est prêt pour le déploiement en production ! 🎉