# 🚀 Guide de déploiement Render - Actions à faire

## ✅ Code prêt
Le code est déjà poussé sur GitHub avec `render.yaml` configuré !

---

## 📋 Étapes à suivre (5 minutes)

### Étape 1️⃣ : Créer un compte Render

1. Va sur : **https://render.com/**
2. Clique sur **Get Started** (bouton bleu)
3. Choisis **Sign up with GitHub**
4. Autorise Render à accéder à tes repos

---

### Étape 2️⃣ : Créer le Web Service

1. Dans le Dashboard, clique **New +** (en haut à droite)
2. Sélectionne **Web Service**
3. Cherche et sélectionne le repo : **Loutxo/bam-backend**
4. Clique **Connect**

---

### Étape 3️⃣ : Configuration du service

Remplis le formulaire :

```
Name:              bam-api
Region:            Frankfurt (Europe)
Branch:            main
Root Directory:    (laisser vide)
Runtime:           Node
Build Command:     npm install
Start Command:     node bam-auth-server.js
Instance Type:     Free
```

---

### Étape 4️⃣ : Variables d'environnement

Clique sur **Advanced** puis **Add Environment Variable**

Ajoute ces 7 variables une par une :

```bash
# 1
NODE_ENV = production

# 2
PORT = 10000

# 3 (copie depuis .env.production ligne 9)
SUPABASE_URL = https://tzlomhuhtmocywpjpyxd.supabase.co

# 4 (copie depuis .env.production ligne 11)
SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6bG9taHVodG1vY3l3cGpweXhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MzQ2NjcsImV4cCI6MjA3ODExMDY2N30.oqJhRocW3ENizx1IaG8GpWpzj_cQbUUJ8-iJZ2Blr0A

# 5 (copie depuis .env.production ligne 12)
SUPABASE_SERVICE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6bG9taHVodG1vY3l3cGpweXhkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjUzNDY2NywiZXhwIjoyMDc4MTEwNjY3fQ.ABCoOoemLlcWZq1UYHuj50aBy872d_hZuFtursKtUlA

# 6
RATE_LIMIT_WINDOW_MS = 900000

# 7
RATE_LIMIT_MAX_REQUESTS = 100
```

---

### Étape 5️⃣ : Déployer !

1. Clique **Create Web Service** (bouton bleu en bas)
2. Render va automatiquement :
   - ✅ Cloner ton repo
   - ✅ Installer les dépendances
   - ✅ Démarrer le serveur
   
⏱️ **Attends 2-3 minutes** pendant le build

---

### Étape 6️⃣ : Récupérer l'URL

Une fois déployé, tu verras en haut de la page :

```
https://bam-api-xxxxx.onrender.com
```

📋 **Copie cette URL** ! Tu en auras besoin pour l'app mobile.

---

### Étape 7️⃣ : Tester l'API

Ouvre un terminal et teste :

```bash
curl https://bam-api-xxxxx.onrender.com/
```

✅ **Résultat attendu** : JSON avec la liste des 10 endpoints

---

## 🔄 Déploiement automatique

À chaque `git push origin main`, Render redéploiera automatiquement !

---

## 📱 Prochaine étape : Mettre à jour l'app mobile

Une fois déployé, **envoie-moi l'URL Render** et je mettrai à jour :
- `bam-mobile/src/constants/config.ts`
- `bam-mobile/src/services/api.ts`

Pour remplacer l'ancienne URL Vercel.

---

## ❓ En cas de problème

**Logs en temps réel** : Dashboard Render → Onglet **Logs**

**Erreurs courantes** :
- ❌ Build failed : Vérifie que toutes les variables d'env sont bien copiées
- ⏳ Cold start : Normal si pas utilisé depuis 15min (plan gratuit)
- 🔴 Service crashed : Check les logs, souvent une variable manquante

---

## 💡 Avantages Render vs Vercel

✅ Support Express natif  
✅ WebSockets fonctionnels  
✅ Pas de limitations serverless  
✅ Déploiement Git automatique  
✅ Gratuit (750h/mois)  

**GO !** 🚀
