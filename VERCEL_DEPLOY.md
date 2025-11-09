# 🚀 Déploiement Vercel - BAM API

## ✅ État actuel
- **Code**: Prêt et poussé sur GitHub (commit 8cb6389)
- **Configuration**: `vercel.json` configuré pour serverless
- **Export**: `module.exports = app` au bon endroit

## 🔴 Problème actuel
Erreur: `FUNCTION_INVOCATION_FAILED`

**Cause**: Les variables d'environnement ne sont pas configurées sur Vercel.

## 📝 Configuration requise sur Vercel Dashboard

### 1. Aller sur Vercel Dashboard
https://vercel.com/dashboard

### 2. Sélectionner le projet `bam-backend`

### 3. Settings → Environment Variables

Ajouter ces variables (valeurs dans `.env.production`):

| Variable | Valeur |
|----------|--------|
| `SUPABASE_URL` | `https://tzlomhuhtmocywpjpyxd.supabase.co` |
| `SUPABASE_ANON_KEY` | Voir `.env.production` |
| `SUPABASE_SERVICE_KEY` | Voir `.env.production` |
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `RATE_LIMIT_WINDOW_MS` | `900000` |
| `RATE_LIMIT_MAX_REQUESTS` | `100` |

### 4. Environments
Cocher:
- ✅ Production
- ✅ Preview
- ✅ Development

### 5. Redéployer

Aller dans **Deployments** → Dernier déploiement → **Redeploy**

Ou pousser un commit vide:
```bash
git commit --allow-empty -m "trigger: redeploy with env vars"
git push origin main
```

## 🧪 Test après déploiement

```bash
# Test endpoint racine
curl https://bam-api-supabase.vercel.app/

# Devrait retourner:
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

## 📚 Documentation complète
- Architecture: `API_ALIGNMENT.md`
- Développement: `DEVELOPER.md`
