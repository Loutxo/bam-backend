# 🐛 Guide de Debug Render - Application Crashed

## ❌ Erreur actuelle
```
Deploy failed for f8cc080: docs: add step-by-step Render deployment guide
Application exited early while running your code. Check your deploy logs for more information.
```

## 🔍 Causes probables

### 1. Variables d'environnement manquantes ⚠️
**VÉRIFIEZ IMPÉRATIVEMENT** que ces 3 variables sont définies dans Render Dashboard :

```bash
SUPABASE_URL=https://tzlomhuhtmocywpjpyxd.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Comment vérifier :**
1. Dashboard Render → https://dashboard.render.com
2. Sélectionnez votre service **bam-api**
3. Onglet **Environment** (à gauche)
4. **Vérifiez que les 3 variables ci-dessus sont présentes et NON VIDES**

### 2. PORT mal configuré
Render définit automatiquement `PORT=10000`. Votre code doit utiliser :
```javascript
const PORT = process.env.PORT || 3000;
```
✅ `bam-auth-server.js` ligne 11 → **CORRECT**

### 3. Dépendances manquantes
Vérifiez que toutes les dépendances sont dans `package.json` :
```bash
npm install --save express cors @supabase/supabase-js express-rate-limit bcryptjs
```

### 4. Module Supabase non trouvé
Si erreur `Cannot find module '@supabase/supabase-js'` :
```bash
# Dans Render Dashboard → Environment
NODE_ENV=production
```

## 📋 Checklist de Debug

### Étape 1 : Vérifier les logs Render
1. Dashboard Render → Service **bam-api**
2. Onglet **Logs** (en haut)
3. Cherchez la ligne contenant l'erreur exacte :
   - `Error: Cannot find module...` → Dépendance manquante
   - `Error: SUPABASE_URL is required` → Variable env manquante
   - `TypeError: createClient is not a function` → Import Supabase incorrect

### Étape 2 : Vérifier les variables d'environnement
```bash
# Dans Render Dashboard → Environment, vérifiez :
✅ NODE_ENV = production
✅ PORT = 10000
✅ SUPABASE_URL = https://tzlomhuhtmocywpjpyxd.supabase.co
✅ SUPABASE_ANON_KEY = eyJhbG... (longue chaîne)
✅ SUPABASE_SERVICE_KEY = eyJhbG... (longue chaîne DIFFÉRENTE)
✅ RATE_LIMIT_WINDOW_MS = 900000
✅ RATE_LIMIT_MAX_REQUESTS = 100
```

### Étape 3 : Vérifier le Build
Dans les logs, cherchez :
```bash
==> Building...
npm install
...
==> Build succeeded
```

Si le build échoue :
- Vérifiez `package.json` (syntaxe JSON valide)
- Vérifiez `package-lock.json` existe

### Étape 4 : Vérifier le Start Command
Dans `render.yaml` ligne 7 :
```yaml
startCommand: node bam-auth-server.js
```

Dans les logs, vous devriez voir :
```bash
==> Running 'node bam-auth-server.js'
🚀 Serveur BAM démarré sur le port 10000
✅ Supabase connecté - Auth prêt
```

## 🔧 Solutions selon l'erreur

### Si erreur : `SUPABASE_URL is required`
```bash
# Render Dashboard → Environment → Add Environment Variable
# Ajoutez les 3 clés Supabase (voir .env.production)
```

### Si erreur : `Cannot find module '@supabase/supabase-js'`
```bash
# Render re-build automatiquement après modification de package.json
# Vérifiez que package.json contient :
"dependencies": {
  "@supabase/supabase-js": "^2.80.0"
}
```

### Si erreur : `Port 3000 is already in use`
❌ **IMPOSSIBLE sur Render** (environnement isolé)
→ Si cette erreur apparaît, c'est un problème de code

### Si erreur : `Error: listen EADDRINUSE: address already in use`
```javascript
// Vérifiez qu'il n'y a qu'UN SEUL app.listen() dans bam-auth-server.js
// Ligne 677 : UNIQUE
app.listen(PORT, async () => { ... });
```

## 🎯 Test de Santé Minimal

Ajoutez cette route en ligne 670 de `bam-auth-server.js` :
```javascript
// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: {
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      HAS_SUPABASE_URL: !!process.env.SUPABASE_URL,
      HAS_SUPABASE_KEY: !!process.env.SUPABASE_ANON_KEY
    }
  });
});
```

Puis testez :
```bash
curl https://bam-api-qw9p.onrender.com/health
```

## 📞 Dernière solution : Support Render
Si rien ne fonctionne :
1. Dashboard Render → Help (en bas à droite)
2. Ou : https://render.com/docs/troubleshooting-deploys
3. Ou : Community Forum → https://community.render.com

## 🔄 Redéploiement forcé
Si tout est OK mais l'app ne démarre toujours pas :
```bash
# Render Dashboard → Manual Deploy
# Ou bien :
git commit --allow-empty -m "trigger: force redeploy"
git push origin main
```

## 📝 Prochaines étapes
Une fois l'erreur identifiée dans les logs :
1. Corrigez le code local
2. Commitez : `git add . && git commit -m "fix: render deployment issue"`
3. Push : `git push origin main`
4. Render redéploie automatiquement
5. Attendez 2-3 minutes
6. Testez : `curl https://bam-api-qw9p.onrender.com/`
