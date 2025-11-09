# 🎯 GUIDE DE TEST POSTMAN - PHASE 2 BAM API

## 🚀 PRÉPARATION

### 1. Configuration Postman
1. **Importer la collection** : `BAM-API-Phase2-Complete.postman_collection.json`
2. **Importer l'environnement** : `BAM-Phase2-Environment.postman_environment.json`
3. **Sélectionner l'environnement** "BAM API Phase 2 - Testing Environment"

### 2. Démarrage de l'application
```bash
# Dans le dossier bam-backend
npm install          # Si pas encore fait
npm start           # Démarre l'API sur http://localhost:3000
```

## 🧪 SÉQUENCE DE TESTS RECOMMANDÉE

### ÉTAPE 1 : Setup Initial
Exécuter dans l'ordre :

1. **🚀 SETUP > Register Test User**
   - Crée un utilisateur normal
   - Sauvegarde automatiquement le token JWT

2. **🚀 SETUP > Register Admin User**  
   - Crée un utilisateur admin
   - Sauvegarde le token admin

3. **🚀 SETUP > Create Test BAM**
   - Crée une BAM pour les tests
   - Sauvegarde l'ID BAM

### ÉTAPE 2 : Tests Fonctionnels

#### A. 🛡️ SYSTÈME DE SIGNALEMENT
```
1. Créer Signalement BAM
2. Lister Mes Signalements  
3. Statistiques Signalements
```
**Résultats attendus :**
- Signalement créé avec statut PENDING
- Auto-modération déclenche des règles
- Statistiques mises à jour

#### B. 🏆 GAMIFICATION COMPLÈTE
```
1. Profil Gamification (voir points initiaux)
2. Ajouter Points Manuel (+25 points)
3. Historique Points (voir l'historique)
4. Mes Badges (badges débloqués automatiquement)
5. Tous les Badges Disponibles (10 badges système)
6. Streak Quotidienne (voir streak actuelle)
7. Incrémenter Streak (+1 jour)
8. Leaderboard Général (classement)
9. Ma Position Leaderboard (position personnelle)
```
**Résultats attendus :**
- Points accumulés correctement
- Badges débloqués automatiquement
- Streaks incrémentées
- Position dans les leaderboards

#### C. 📍 GÉOLOCALISATION AVANCÉE
```
1. Enregistrer Position (Paris)
2. Historique Positions (voir l'historique)
3. Position Actuelle (dernière position)
4. Créer Zone Favorite ("Mon Bureau" 500m)
5. Mes Zones Favorites (liste des zones)
6. Alertes Géofence (notifications auto)
7. Calculer Distance (Paris-Lyon)
8. Statistiques Géolocalisation (analytics)
```
**Résultats attendus :**
- Positions enregistrées avec précision
- Géofencing détecte entrée/sortie zones
- Calculs de distance précis (Haversine)
- Stats géographiques détaillées

#### D. 🏢 DASHBOARD ADMIN
```
1. Statistiques Dashboard (vue d'ensemble)
2. Liste Utilisateurs (avec filtres)
3. File Modération (reports en attente)
4. Analytics Usage (métriques d'usage)
```
**Résultats attendus :**
- Statistiques complètes plateforme
- Gestion utilisateurs avec permissions
- File modération organisée
- Analytics détaillés

### ÉTAPE 3 : Tests Temps Réel
```
1. Statistiques WebSocket
2. Utilisateurs Connectés
```

### ÉTAPE 4 : Validation Finale
```
1. Health Check (statut API)
2. Test Toutes Fonctionnalités Phase 2 (validation complète)
```

## 📊 RÉSULTATS ATTENDUS PAR FONCTIONNALITÉ

### 🛡️ Signalement & Modération
- [x] Création signalements tous types (BAM, User, Message)
- [x] Auto-modération avec filtres intelligents  
- [x] Sanctions automatiques progressives
- [x] Notifications temps réel via WebSocket

### 🏆 Gamification
- [x] Système de points multi-catégories
- [x] 10 badges avec 5 niveaux de rareté
- [x] Streaks quotidiennes avec bonus
- [x] Leaderboards dynamiques (daily/weekly/monthly)
- [x] Notifications achievement en temps réel

### 📍 Géolocalisation
- [x] Enregistrement positions multi-sources
- [x] Géofencing avec zones personnalisables
- [x] Historique et analytics géographiques
- [x] Notifications de proximité automatiques
- [x] Calculs de distance précis

### 🏢 Administration
- [x] Dashboard statistiques complètes
- [x] Gestion utilisateurs avec rôles
- [x] File modération organisée
- [x] Analytics d'usage détaillés

## 🚨 POINTS DE VALIDATION CRITIQUES

### Sécurité
- ✅ Authentification JWT obligatoire partout
- ✅ Permissions admin/modérateur respectées
- ✅ Validation stricte des données entrantes
- ✅ Protection contre l'auto-suppression droits admin

### Performance  
- ✅ APIs répondent < 500ms en moyenne
- ✅ Pagination sur toutes les listes
- ✅ Requêtes optimisées avec indexes
- ✅ WebSocket stable et réactif

### Fonctionnalités
- ✅ Toutes les API retournent les bonnes structures JSON
- ✅ Auto-modération fonctionne en arrière-plan
- ✅ Gamification s'intègre automatiquement aux actions
- ✅ Géofencing détecte les entrées/sorties zones
- ✅ Admin dashboard accessible uniquement aux admins

## 🎉 CRITÈRES DE SUCCÈS

**Phase 2 est validée si :**
1. ✅ Tous les endpoints API répondent correctement
2. ✅ Authentification et permissions fonctionnent
3. ✅ Auto-modération traite le contenu automatiquement
4. ✅ Gamification attribue points et badges automatiquement  
5. ✅ Géofencing détecte les mouvements géographiques
6. ✅ Dashboard admin affiche les bonnes statistiques
7. ✅ WebSocket diffuse les notifications temps réel
8. ✅ Aucune erreur 500 sur les fonctionnalités principales

## 🛠️ TROUBLESHOOTING

### Si l'API ne démarre pas :
```bash
# Vérifier les dépendances
npm install

# Vérifier la configuration
cat .env

# Tester sans DB
node test-geolocation.js
node test-admin.js
```

### Si certaines API échouent :
1. Vérifier que les tokens JWT sont valides
2. Vérifier les permissions utilisateur/admin
3. Vérifier les données envoyées (format JSON)
4. Consulter les logs de l'application

### Tests rapides en cas de problème DB :
```bash
node test-geolocation.js    # Test géolocalisation avec mocks
node test-admin.js          # Test admin dashboard avec mocks
npm test                    # Tests unitaires complets
```

---

**🎯 Objectif : Valider que la Phase 2 BAM API est 100% fonctionnelle et prête pour la production !**