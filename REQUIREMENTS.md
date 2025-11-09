# BAM Backend - Requirements et Dépendances

## 📦 Dépendances de Production

### Core Backend
- express@^5.1.0                # Framework web minimaliste
- @prisma/client@^6.13.0        # Client ORM pour base de données
- prisma@^6.13.0               # ORM et générateur de client
- dotenv@^17.2.1               # Gestion variables d'environnement

### Sécurité
- cors@^2.8.5                  # Cross-Origin Resource Sharing
- helmet@^7.2.0                # Sécurisation headers HTTP
- express-rate-limit@^7.5.1    # Limitation taux de requêtes
- express-validator@^7.2.1     # Validation et sanitization
- jsonwebtoken@^9.0.2          # JSON Web Tokens (JWT) [À INSTALLER]
- bcryptjs@^2.4.3             # Hashage sécurisé mots de passe [À INSTALLER]

### Utilitaires (À INSTALLER)
- morgan@^1.10.0              # Logger HTTP requests
- compression@^1.7.4          # Compression gzip
- multer@^1.4.5-lts.1        # Upload de fichiers

## 🧪 Dépendances de Développement

### Tests
- jest@^29.7.0                # Framework de tests
- supertest@^6.3.4           # Tests d'API HTTP
- @types/jest@^29.5.5        # Types TypeScript pour Jest [OPTIONNEL]

### Qualité de Code
- eslint@^8.57.1             # Linter JavaScript
- nodemon@^3.1.10            # Rechargement automatique développement
- prettier@^3.0.3            # Formatage automatique code [À INSTALLER]

### Monitoring (Production)
- winston@^3.11.0            # Logger avancé [À INSTALLER]
- sentry@^7.74.1            # Monitoring erreurs [À INSTALLER]

## 🚀 Installation

### Installation Actuelle
```bash
npm install  # Installe toutes les dépendances existantes
```

### Installation Dépendances Manquantes JWT + Sécurité
```bash
npm install jsonwebtoken bcryptjs morgan compression multer
```

### Installation Dépendances Développement Optionnelles
```bash
npm install --save-dev prettier winston @sentry/node
```

## 🔧 Configuration Requise

### Variables d'Environnement (.env)
```env
# Base de données
DATABASE_URL="postgresql://user:password@localhost:5432/bam_db"

# JWT
JWT_SECRET="your-256-bit-secret"
JWT_EXPIRES_IN="7d"
JWT_REFRESH_EXPIRES_IN="30d"

# Serveur
PORT=3000
NODE_ENV="development"

# Sécurité
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Versions Node.js Recommandées
- **Node.js**: >= 18.0.0
- **NPM**: >= 9.0.0
- **PostgreSQL**: >= 14.0

## 📋 Scripts Disponibles

```bash
# Développement
npm run dev           # Serveur avec rechargement auto
npm run test:watch    # Tests en mode watch

# Production
npm start             # Serveur production
npm run build         # Build (si TypeScript ajouté)

# Base de données
npm run prisma:migrate    # Migrations
npm run prisma:studio     # Interface admin DB
npm run prisma:generate   # Génération client

# Qualité
npm test              # Tests complets
npm run test:coverage # Couverture de code
npm run lint          # Vérification style
npm run lint:fix      # Correction automatique
npm run format        # Formatage avec Prettier (à installer)
```

## 🎯 Statut Actuel

### ✅ Installé et Fonctionnel
- [x] Express + middlewares base
- [x] Prisma ORM
- [x] Rate limiting
- [x] Validation données
- [x] Tests Jest (10/10 ✅)
- [x] ESLint configuré

### 🔄 En Cours d'Installation
- [ ] JWT Authentication
- [ ] Bcrypt password hashing
- [ ] Logger Morgan

### 📋 Prochaines Étapes
1. Installation JWT + Bcrypt
2. Middleware d'authentification
3. Intégration sécurité dans routes
4. Tests d'authentification