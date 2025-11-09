# Configuration pour déploiement Supabase + Vercel

## Étapes de déploiement moderne

### 1. Créer un projet Supabase
1. Allez sur https://supabase.com
2. Créez un nouveau projet
3. Notez votre `Project URL` et `anon public key`

### 2. Migration de votre base de données
```bash
# Installation Supabase CLI
npm install -g supabase

# Login et liaison projet
supabase login
supabase init
supabase link --project-ref YOUR_PROJECT_ID

# Migration de votre schema Prisma vers Supabase
# Copiez le contenu de votre schema.prisma dans l'éditeur SQL Supabase
```

### 3. Configuration Vercel
```bash
# Installation Vercel CLI
npm install -g vercel

# Déploiement
vercel

# Configuration des variables d'environnement
vercel env add DATABASE_URL
vercel env add JWT_SECRET
vercel env add NODE_ENV
```

### 4. Variables d'environnement Vercel
```
DATABASE_URL=postgresql://postgres:[YOUR_PASSWORD]@db.[YOUR_PROJECT_REF].supabase.co:5432/postgres
SUPABASE_URL=https://[YOUR_PROJECT_REF].supabase.co
SUPABASE_ANON_KEY=[YOUR_ANON_KEY]
JWT_SECRET=[YOUR_SECRET]
NODE_ENV=production
```

### 5. Configuration automatique
Votre `vercel.json` est prêt dans le projet pour déployer automatiquement.

### Avantages Supabase:
- Base PostgreSQL avec extensions PostGIS pour géolocalisation
- Dashboard admin intégré
- Authentification prête
- Real-time subscriptions
- Edge functions pour performance
- Storage pour images

### Test après déploiement:
Votre API sera disponible sur: `https://votre-projet.vercel.app`

Testez avec votre collection Postman en changeant la baseUrl.