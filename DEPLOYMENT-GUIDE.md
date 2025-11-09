# 🚀 Guide de Déploiement BAM API - Phase 2

## 📊 Configuration Actuelle

### Base de Données
- **Type:** PostgreSQL
- **Config locale:** `postgresql://test:test@localhost:5432/test_db`
- **ORM:** Prisma avec migrations automatiques
- **Schema:** 670 lignes, modèles complets (User, Bam, Gamification, Location, etc.)

### Application
- **Framework:** Node.js + Express
- **Port:** 3000
- **Authentification:** JWT (préparé)
- **WebSocket:** Socket.io intégré
- **Géolocalisation:** Services avancés prêts

---

## 🎯 Options de Déploiement Recommandées

### Option 1: 🟢 **Déploiement Express (Recommandé)**
**Heroku + PostgreSQL Hébergé**

#### Avantages:
- ✅ Gratuit ou très peu cher pour commencer
- ✅ Base de données gérée automatiquement  
- ✅ CI/CD intégré avec GitHub
- ✅ SSL automatique
- ✅ Monitoring intégré

#### Coût:
- **Gratuit** pour testing (Heroku Eco)
- **~7€/mois** pour production (Heroku Basic + Postgres)

---

### Option 2: 🔵 **Déploiement Cloud Moderne**
**Vercel + Supabase**

#### Avantages:
- ✅ Performance maximale (Edge functions)
- ✅ Base PostgreSQL + API temps réel
- ✅ Dashboard admin intégré
- ✅ Authentification clé-en-main
- ✅ Géolocalisation optimisée

#### Coût:
- **Gratuit** pour développement
- **~10€/mois** pour production

---

### Option 3: 🟡 **Solution Économique**
**Railway + PostgreSQL**

#### Avantages:
- ✅ Très économique
- ✅ Configuration simple
- ✅ Monitoring inclus
- ✅ Variables d'environnement sécurisées

#### Coût:
- **5$/mois** tout compris

---

## 🛠️ Déploiement Pas-à-Pas - Option 1 (Heroku)

### Étape 1: Préparation du Code

```bash
# 1. Configuration Heroku
echo 'web: npm start' > Procfile

# 2. Variables d'environnement production
# DATABASE_URL sera fourni automatiquement par Heroku Postgres
PORT=\${PORT:-3000}
NODE_ENV=production
JWT_SECRET=votre_secret_super_securise_32_caracteres
```

### Étape 2: Configuration Heroku

```bash
# Installation Heroku CLI
# https://devcenter.heroku.com/articles/heroku-cli

# Connexion et création app
heroku login
heroku create bam-api-phase2

# Ajout PostgreSQL addon
heroku addons:create heroku-postgresql:mini

# Configuration des variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=votre_secret_ici
```

### Étape 3: Déploiement

```bash
# Déploiement GitHub (recommandé)
git add .
git commit -m \"Phase 2 ready for production\"
git push heroku main

# Ou déploiement direct
git remote add heroku https://git.heroku.com/bam-api-phase2.git
git push heroku main
```

### Étape 4: Migration Base de Données

```bash
# Migration Prisma sur Heroku
heroku run npm run prisma:deploy

# Vérification
heroku logs --tail
```

---

## 🔒 Configuration Sécurisée

### Variables d'Environnement Production

```env
# Base de données (fournie par Heroku)
DATABASE_URL=postgres://user:pass@host:5432/db

# Application
NODE_ENV=production
PORT=\${PORT}

# Authentification
JWT_SECRET=un_secret_tres_securise_de_32_caracteres_minimum
JWT_EXPIRES_IN=24h

# API Keys (si nécessaire)
FIREBASE_PROJECT_ID=votre-projet-firebase
GOOGLE_MAPS_API_KEY=votre-cle-google-maps

# Monitoring
SENTRY_DSN=https://...@sentry.io/...
```

### Sécurisation Supplémentaire

```javascript
// index.js - Configuration production
if (process.env.NODE_ENV === 'production') {
  // HTTPS only
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://\${req.header('host')}\${req.url}`);
    } else {
      next();
    }
  });

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: [\"'self'\"],
        scriptSrc: [\"'self'\"],
        styleSrc: [\"'self'\", \"'unsafe-inline'\"],
        imgSrc: [\"'self'\", 'data:', 'https:']
      }
    }
  }));
}
```

---

## 🧪 Déploiement avec Supabase (Option 2)

### Avantages pour BAM:
- **Base PostgreSQL** avec extensions géospatiales
- **Authentification** prête (JWT, OAuth, etc.)
- **Real-time subscriptions** pour WebSocket
- **Storage** pour images/fichiers
- **Edge Functions** pour performance

### Configuration Supabase:

```javascript
// supabase-config.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

// Géolocalisation avec PostGIS
const nearbyUsers = await supabase
  .from('users')
  .select('*')
  .lt('location', `POINT(\${longitude} \${latitude})`, { 
    distance: 1000 // 1km radius
  })
```

### Migration Prisma → Supabase:

```sql
-- Migration automatique des modèles Prisma
-- Supabase peut importer votre schema.prisma directement
npx supabase db diff --schema prisma/schema.prisma
```

---

## 📱 Configuration Mobile Ready

### WebSocket pour Temps Réel

```javascript
// Production WebSocket config
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://votre-app.com', 'https://admin.votre-app.com']
      : ['http://localhost:3000', 'http://localhost:8080'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});
```

### API Géolocalisation Optimisée

```javascript
// Optimisation pour mobile
app.use('/api/location', rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requêtes/minute pour géolocalisation
  message: 'Trop de mises à jour de position'
}));
```

---

## 🔍 Monitoring et Maintenance

### Health Checks

```javascript
// health-check.js
app.get('/health', async (req, res) => {
  try {
    // Test DB connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Test external APIs
    const checks = {
      database: 'OK',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date(),
      version: '2.0.0'
    };
    
    res.json(checks);
  } catch (error) {
    res.status(500).json({ error: 'Health check failed' });
  }
});
```

### Logging Production

```javascript
// logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'app.log' })
  ]
});

// Usage
logger.info('User login', { userId: user.id, ip: req.ip });
logger.error('Database error', { error: err.message });
```

---

## 💰 Estimation des Coûts

### Petit Volume (0-1000 utilisateurs)

| Service | Provider | Coût/mois |
|---------|----------|-----------|
| **API Backend** | Heroku Basic | 7€ |
| **PostgreSQL** | Heroku Postgres Mini | Inclus |
| **Domain + SSL** | Gratuit | 0€ |
| **Monitoring** | Heroku Metrics | Gratuit |
| **Total** | | **7€/mois** |

### Volume Moyen (1000-10k utilisateurs)

| Service | Provider | Coût/mois |
|---------|----------|-----------|
| **API Backend** | Heroku Standard | 25€ |
| **PostgreSQL** | Heroku Postgres Standard | 9€ |
| **Redis Cache** | Heroku Redis Mini | 3€ |
| **CDN** | Cloudflare Pro | 20€ |
| **Monitoring** | Sentry | 26€ |
| **Total** | | **83€/mois** |

---

## 🚀 Plan de Migration Recommandé

### Phase 1: Test Déploiement (Cette semaine)
1. ✅ Créer compte Heroku/Supabase
2. ✅ Déployer version test
3. ✅ Tester avec collection Postman
4. ✅ Valider tous les endpoints

### Phase 2: Production Setup (Semaine prochaine)  
1. 🔄 Configuration domaine personnalisé
2. 🔄 SSL et sécurité renforcée
3. 🔄 Monitoring et alertes
4. 🔄 Backup automatique BDD

### Phase 3: Optimisation (Mois suivant)
1. ⏳ CDN pour assets statiques
2. ⏳ Cache Redis pour performance
3. ⏳ Analytics avancées
4. ⏳ Tests de charge

---

## ✅ Checklist Pré-Déploiement

### Code
- ✅ Tous les endpoints testés
- ✅ Gestion d'erreurs complète
- ✅ Variables d'environnement sécurisées
- ✅ Logs en production
- ⬜ Tests unitaires (optionnel)

### Base de Données
- ✅ Schema Prisma finalisé
- ✅ Migrations testées
- ⬜ Seed data pour demo
- ⬜ Backup strategy

### Sécurité
- ⬜ JWT secrets uniques
- ⬜ CORS configuré
- ⬜ Rate limiting activé
- ⬜ HTTPS forcé

### Monitoring
- ⬜ Health checks
- ⬜ Error tracking
- ⬜ Performance monitoring
- ⬜ Uptime monitoring

---

## 🎯 Action Immédiate Recommandée

**Je recommande Option 1 (Heroku) pour commencer car:**
1. Configuration la plus simple
2. Coût minimal
3. PostgreSQL inclus 
4. Compatible avec votre code actuel
5. Scalable facilement

**Prochaine étape:** Voulez-vous que je prépare les fichiers de configuration pour Heroku ou préférez-vous une autre option ?

---

*Votre API BAM Phase 2 est production-ready ! 🎉*