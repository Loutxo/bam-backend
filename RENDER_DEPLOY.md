# 🚀 Déploiement Render - BAM API

## ✅ Pourquoi Render au lieu de Vercel

- **✅ Support Express natif** : Render exécute Node.js en continu (pas serverless)
- **✅ WebSockets supportés** : Compatible avec toutes les features de `bam-auth-server.js`
- **✅ Déploiement Git automatique** : Push → Deploy automatiquement
- **✅ Gratuit** : 750h/mois (suffisant pour un projet personnel)
- **❌ Vercel** : Optimisé pour Next.js, incompatible avec notre architecture Express complexe

## 📝 Instructions de déploiement (5 minutes)

### 1. Créer un compte Render

1. Va sur : https://render.com/
2. Clique **Get Started**
3. Connecte-toi avec GitHub (ou email)
4. Autorise Render à accéder à tes repos GitHub

### 2. Créer le Web Service

1. Dans le Dashboard Render, clique **New +** → **Web Service**
2. Sélectionne le repo **Loutxo/bam-backend**
3. Configure :

| Paramètre | Valeur |
|-----------|--------|
| **Name** | `bam-api` |
| **Region** | `Frankfurt (Europe)` |
| **Branch** | `main` |
| **Root Directory** | (laisser vide) |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node bam-auth-server.js` |
| **Plan** | `Free` |

4. Clique **Advanced** pour ajouter les variables d'environnement

### 3. Ajouter les variables d'environnement

Dans la section **Environment Variables**, ajoute :

```bash
NODE_ENV=production
PORT=10000
SUPABASE_URL=https://tzlomhuhtmocywpjpyxd.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6bG9taHVodG1vY3l3cGpweXhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MzQ2NjcsImV4cCI6MjA3ODExMDY2N30.oqJhRocW3ENizx1IaG8GpWpzj_cQbUUJ8-iJZ2Blr0A
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6bG9taHVodG1vY3l3cGpweXhkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjUzNDY2NywiZXhwIjoyMDc4MTEwNjY3fQ.ABCoOoemLlcWZq1UYHuj50aBy872d_hZuFtursKtUlA
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

💡 **Copie-colle les valeurs depuis `.env.production`**

### 4. Déployer

1. Clique **Create Web Service**
2. Render va :
   - Cloner ton repo
   - Installer les dépendances (`npm install`)
   - Démarrer le serveur (`node bam-auth-server.js`)
   
⏱️ **Durée** : 2-3 minutes

### 5. Tester l'API

Une fois déployé, tu auras une URL du type :
```
https://bam-api-xxxxx.onrender.com
```

Teste avec :
```bash
curl https://bam-api-xxxxx.onrender.com/
```

Devrait retourner :
```json
{
  "message": "🌊 BAM API - Bouteille à la Mer",
  "version": "2.0.0",
  "endpoints": {
    "public": {
      "health": "GET /",
      "auth_register": "POST /auth/register",
      "auth_login": "POST /auth/login"
    },
    "protected": {
      "auth_me": "GET /auth/me (Bearer token)",
      "badges": "GET /api/badges (Bearer token)",
      "bams_create": "POST /api/bams (Bearer token)",
      "bams_get": "GET /api/bams/:id (Bearer token)",
      "bams_update": "PUT /api/bams/:id (Bearer token)",
      "bams_delete": "DELETE /api/bams/:id (Bearer token)",
      "bams_nearby": "GET /api/bams/nearby?lat=X&lon=Y (Bearer token)",
      "reviews_create": "POST /api/reviews (Bearer token)",
      "calls_create": "POST /api/calls (Bearer token)"
    }
  }
}
```

## 🔄 Déploiement automatique

À chaque `git push origin main`, Render redéploie automatiquement ! 🎉

## 📱 Mettre à jour l'app mobile

Une fois déployé, mets à jour l'URL dans :
- `bam-mobile/src/constants/config.ts` : `API_URL`
- `bam-mobile/src/services/api.ts` : `baseURL`

Remplace `https://bam-api-supabase.vercel.app` par ton URL Render.

## 🐛 Logs et monitoring

- **Logs** : Dashboard Render → Ton service → Onglet **Logs**
- **Metrics** : CPU, RAM, requêtes/sec
- **Shell** : Accès shell SSH pour debug

## 💰 Plan gratuit

- **750h/mois** : ~31 jours (mais sleep après 15min d'inactivité)
- **512MB RAM** : Suffisant pour Express
- **Premier démarrage lent** : Cold start de ~30s si pas utilisé depuis 15min
- **Upgrade Pro** : $7/mois pour instance toujours active

## ✅ Avantages vs Vercel

| Feature | Render | Vercel |
|---------|--------|--------|
| Express complet | ✅ | ❌ |
| WebSockets | ✅ | ❌ |
| Background tasks | ✅ | ⚠️ (limité) |
| Déploiement auto | ✅ | ✅ |
| Gratuit | ✅ | ✅ |
| Cold start | ~30s | ~500ms |

## 🔧 Prochaines étapes

1. ✅ Déployer sur Render (tu es ici)
2. 🔄 Mettre à jour l'URL dans l'app mobile
3. 🧪 Tester signup → login → create BAM
4. 🎯 Tester les badges et la géolocalisation

---

📖 **Support Render** : https://render.com/docs
🎯 **Code prêt** : `bam-auth-server.js` fonctionne directement !
