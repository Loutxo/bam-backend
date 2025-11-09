# 🧭 BAM - Bouteille À la Mer

Backend de l'application mobile BAM (Bouteille À la Mer), une plateforme de services géolocalisés éphémères.

## 📱 Concept

BAM permet aux utilisateurs de publier des demandes de services géolocalisées et temporaires (comme une "bouteille à la mer" numérique). Les utilisateurs peuvent répondre aux BAMs proches, communiquer via chat éphémère, et s'appeler pour finaliser l'échange.

## 🚀 Démarrage Rapide

### Prérequis
- Node.js 18+
- PostgreSQL 14+
- npm/yarn

### Installation
```bash
# Cloner le repo
git clone https://github.com/Loutxo/bam-backend.git
cd bam-backend

# Installer les dépendances
npm install

# Configuration base de données
cp .env.example .env
# Éditer .env avec vos paramètres DB

# Migrations Prisma
npx prisma migrate deploy
npx prisma generate

# Lancer le serveur
npm start
```

## 🏗️ Architecture

### Stack Technique
- **Backend:** Node.js + Express.js
- **ORM:** Prisma
- **Base de données:** PostgreSQL
- **Authentification:** À implémenter (JWT recommandé)
- **Géolocalisation:** Calcul de distance haversine

### Structure Projet
```
├── routes/              # Routes API REST
│   ├── users.js        # Gestion utilisateurs
│   ├── bams.js         # BAMs et interactions
│   ├── calls.js        # Enregistrement appels
│   └── reviews.js      # Système notation
├── prisma/             # Schema et migrations DB
├── middleware/         # Middlewares (à créer)
└── utils/             # Utilitaires (à créer)
```

## 📊 Modèle de Données

### Entités Principales

**User** - Utilisateurs de la plateforme
- `id`, `pseudo`, `phone`, `photoUrl`, `score`

**Bam** - Demandes géolocalisées
- `text`, `price`, `latitude`, `longitude`, `expiresAt`

**Response** - Réponses aux BAMs
- Lien User ↔ Bam

**Message** - Chat éphémère
- Messages liés aux BAMs entre participants

**Call** - Historique d'appels
- Traçabilité des communications

**Review** - Système de notation
- Réputation des utilisateurs (0-5 étoiles)

## 🛠️ API Endpoints

### 👤 Utilisateurs
```http
POST   /users              # Créer utilisateur
GET    /users              # Lister utilisateurs
GET    /users/:id/reviews  # Avis reçus
```

### 🧭 BAMs
```http
POST   /bams                    # Publier BAM
GET    /bams/nearby?lat=&lng=   # BAMs à proximité
POST   /bams/:id/respond        # Répondre à BAM
GET    /bams/:id/responses      # Voir réponses
POST   /bams/:id/messages       # Envoyer message
GET    /bams/:id/messages       # Historique chat
```

### 📞 Appels & Reviews
```http
POST   /calls              # Enregistrer appel
POST   /reviews            # Noter utilisateur
```

## 🔧 Configuration

### Variables d'environnement (.env)
```env
DATABASE_URL="postgresql://user:pass@localhost:5432/bam_db"
JWT_SECRET="your-secret-key"
PORT=3000
```

## 🎯 Fonctionnalités Clés

### Géolocalisation
- Recherche dans un rayon de 2km
- Calcul de distance avec formule haversine
- Coordonnées latitude/longitude

### Système d'Expiration
- BAMs temporaires (durée configurable)
- Nettoyage automatique des BAMs expirés

### Chat Éphémère
- Messages liés aux BAMs
- Communication entre demandeur et répondeurs uniquement

### Réputation
- Notation 0-5 étoiles après interactions
- Score moyen calculé automatiquement

## 📝 À Implémenter

### Priorité 1 - Sécurité
- [ ] Authentification JWT
- [ ] Validation des données d'entrée
- [ ] Rate limiting
- [ ] Sanitization des inputs

### Priorité 2 - Robustesse
- [ ] Tests automatisés
- [ ] Logging structuré
- [ ] Gestion d'erreurs avancée
- [ ] Monitoring des performances

### Priorité 3 - Fonctionnalités
- [ ] Notifications push
- [ ] Upload d'images
- [ ] Modération de contenu
- [ ] Analytics

## 🧪 Tests

```bash
# Tests unitaires (à implémenter)
npm test

# Tests d'intégration
npm run test:integration
```

## 📦 Déploiement

### Production
- Hébergement: Railway, Heroku, ou VPS
- Base de données: PostgreSQL managée
- Monitoring: Sentry, LogRocket
- CDN pour assets statiques

## 🤝 Contribution

1. Fork le projet
2. Créer une branche (`git checkout -b feature/amazing-feature`)
3. Commit (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feature/amazing-feature`)
5. Ouvrir une Pull Request

## 📄 License

MIT - voir [LICENSE](LICENSE)

## 📞 Contact

Louis Rollin - louis.rollin@gmail.com
Lien projet: [https://github.com/Loutxo/bam-backend](https://github.com/Loutxo/bam-backend)
