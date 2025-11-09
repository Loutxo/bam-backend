# BAM Backend - Guide Développeur

## 🚀 Mise en Route

### Configuration Rapide
```bash
# 1. Installation
npm install

# 2. Configuration environnement
cp .env.example .env
# Éditer .env avec vos paramètres

# 3. Base de données
npx prisma migrate dev
npm run db:seed

# 4. Démarrage
npm run dev
```

## 🔧 Architecture du Projet

### Structure des Fichiers
```
bam-backend/
├── config/              # Configuration centralisée
│   └── index.js         # Config principale + validation
├── middleware/          # Middlewares Express
│   ├── auth.js          # Authentification JWT
│   ├── errorHandler.js  # Gestion d'erreurs
│   └── rateLimiting.js  # Rate limiting
├── routes/              # Routes API
│   ├── auth.js          # Authentification
│   ├── bams.js          # Bouteilles à la mer
│   ├── users.js         # Utilisateurs
│   ├── calls.js         # Appels vidéo
│   └── reviews.js       # Système d'avis
├── utils/               # Utilitaires
│   ├── password.js      # Hachage/validation mots de passe
│   └── geolocation.js   # Calculs géographiques
├── tests/               # Tests complets
│   ├── *.test.js        # Tests unitaires
│   └── *.integration.test.js # Tests d'intégration
├── prisma/              # Base de données
│   ├── schema.prisma    # Schéma DB
│   ├── migrations/      # Historique des migrations
│   └── seed.js          # Données de test
└── postman/             # Collections de test API
```

## 🛡️ Sécurité

### Authentification JWT
- **Access Token**: 1h de validité
- **Refresh Token**: 7 jours de validité
- **Middleware**: `authenticateToken`, `optionalAuth`, `requireOwnership`

### Validation des Données
```javascript
// Exemple d'utilisation express-validator
const { body, validationResult } = require('express-validator');

const validateRegistration = [
  body('pseudo').trim().isLength({ min: 2, max: 50 }),
  body('phone').isMobilePhone('fr-FR'),
  body('password').custom(async (password) => {
    const validation = validatePasswordStrength(password);
    if (validation.score < 3) {
      throw new Error(`Mot de passe trop faible: ${validation.feedback.join(', ')}`);
    }
  }),
];
```

### Rate Limiting
```javascript
// Configuration par défaut
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 tentatives max
  skipSuccessfulRequests: true,
});
```

## 📋 Développement d'APIs

### Middleware d'Authentification
```javascript
const { authenticateToken } = require('../middleware/auth');

// Route protégée
router.get('/protected', authenticateToken, (req, res) => {
  // req.user contient les infos de l'utilisateur connecté
  console.log('User ID:', req.user.id);
});

// Route avec authentification optionnelle
router.get('/public', optionalAuth, (req, res) => {
  // req.user peut être null si pas connecté
  if (req.user) {
    console.log('User connecté:', req.user.id);
  }
});
```

### Gestion d'Erreurs
```javascript
const { ApiError } = require('../middleware/errorHandler');

// Lancer une erreur personnalisée
throw new ApiError(400, 'Données invalides', validationErrors);

// Erreur 404 automatique
throw new ApiError(404, 'Ressource non trouvée');

// Erreur 403 avec middleware
router.get('/bams/:id', requireOwnership('BAM'), (req, res) => {
  // Accès automatiquement contrôlé
});
```

### Validation des Entrées
```javascript
const validateBamCreation = [
  body('title').trim().isLength({ min: 3, max: 100 }),
  body('description').trim().isLength({ min: 10, max: 500 }),
  body('latitude').isFloat({ min: -90, max: 90 }),
  body('longitude').isFloat({ min: -180, max: 180 }),
  body('maxParticipants').isInt({ min: 2, max: 20 }),
];

router.post('/bams', authenticateToken, validateBamCreation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, 'Données invalides', errors.array());
  }
  // ... logique métier
});
```

## 🧪 Tests

### Tests Unitaires
```javascript
// tests/example.test.js
describe('Module Example', () => {
  test('should do something', () => {
    expect(result).toBe(expected);
  });
});
```

### Tests d'Intégration
```javascript
// tests/example.integration.test.js
describe('API Integration', () => {
  test('should handle request', async () => {
    const response = await request(app)
      .post('/api/endpoint')
      .send(testData)
      .expect(200);
    
    expect(response.body).toHaveProperty('success');
  });
});
```

### Commandes de Test
```bash
npm run test           # Tous les tests
npm run test:unit      # Tests unitaires seulement
npm run test:integration # Tests d'intégration
npm run test:watch     # Mode watch
npm run test:coverage  # Avec couverture de code
```

## 🗄️ Base de Données

### Modèles Prisma
```javascript
// Accès aux modèles
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Exemples d'utilisation
const user = await prisma.user.findUnique({ where: { id: userId } });
const bams = await prisma.bAM.findMany({ 
  where: { isPublic: true },
  include: { participants: true }
});
```

### Migrations
```bash
# Créer une nouvelle migration
npx prisma migrate dev --name add_new_field

# Appliquer en production
npx prisma migrate deploy

# Reset complet (dev seulement)
npm run db:reset
```

## 🔍 Debugging

### Logs de Debug
```javascript
const debug = require('debug')('bam:module');

debug('Information de debug: %O', data);
```

### Variables d'Environnement Debug
```bash
# Tous les logs BAM
DEBUG=bam:* npm run dev

# Logs spécifiques
DEBUG=bam:auth,bam:database npm run dev
```

### Erreurs Communes

1. **"JWT malformed"**
   - Vérifier le format du token
   - Contrôler la variable JWT_SECRET

2. **"User not found"**
   - Vérifier l'ID utilisateur
   - Contrôler les permissions

3. **Erreur de validation**
   - Vérifier le format des données
   - Consulter `validationResult(req)`

## 📱 Intégration Frontend

### Headers Requis
```javascript
// Authentification
headers: {
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json'
}
```

### Gestion des Tokens
```javascript
// Refresh automatique des tokens
const refreshToken = async (refreshToken) => {
  const response = await fetch('/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });
  
  if (response.ok) {
    const { tokens } = await response.json();
    // Sauvegarder les nouveaux tokens
    return tokens;
  }
  
  // Rediriger vers login
  throw new Error('Session expirée');
};
```

### Websockets (Future)
```javascript
// Structure préparée pour les websockets
const io = require('socket.io')(server);

io.on('connection', (socket) => {
  socket.on('join-bam', (bamId) => {
    socket.join(`bam-${bamId}`);
  });
  
  socket.on('new-message', (data) => {
    socket.to(`bam-${data.bamId}`).emit('message', data);
  });
});
```

## 🚀 Déploiement

### Environnements
```bash
# Développement
NODE_ENV=development npm run dev

# Production
NODE_ENV=production npm start
```

### Variables d'Environnement Production
```env
NODE_ENV=production
PORT=3000
DATABASE_URL="postgresql://user:password@host:5432/db"
JWT_SECRET="super-long-and-secure-secret-key"
REFRESH_JWT_SECRET="another-super-secure-key"
BCRYPT_ROUNDS=12
```

### Docker
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

## 📖 Ressources

### Documentation Officielle
- [Prisma](https://www.prisma.io/docs/)
- [Express.js](https://expressjs.com/)
- [Jest](https://jestjs.io/docs/getting-started)

### Outils Recommandés
- **VSCode Extensions**: Prisma, ESLint, Jest
- **Database Client**: Prisma Studio, pgAdmin
- **API Testing**: Postman, Insomnia
- **Monitoring**: Sentry, LogRocket

---

## ✅ Checklist Nouvelle Fonctionnalité

- [ ] **Route créée** avec authentification appropriée
- [ ] **Validation des entrées** avec express-validator
- [ ] **Tests unitaires** écrits et passants
- [ ] **Tests d'intégration** couvrant les cas principaux
- [ ] **Documentation** mise à jour
- [ ] **Collection Postman** créée/mise à jour
- [ ] **Gestion d'erreurs** implémentée
- [ ] **Rate limiting** configuré si nécessaire

Le système est maintenant prêt pour un développement collaboratif et évolutif ! 🎉