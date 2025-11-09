# BAM Backend - Test d'Intégration API

Ce dossier contient les collections Postman pour tester l'API BAM Backend.

## Configuration

1. Importer les collections Postman dans votre espace de travail
2. Configurer les variables d'environnement :

### Variables d'environnement Postman

```json
{
  "baseUrl": "http://localhost:3000",
  "accessToken": "",
  "refreshToken": "",
  "userId": "",
  "bamId": "",
  "callId": "",
  "reviewId": ""
}
```

## Collections disponibles

### 1. Authentication.postman_collection.json
Tests pour les routes d'authentification :
- Registration (POST /auth/register)
- Login (POST /auth/login) 
- Token Refresh (POST /auth/refresh)

### 2. BAMs.postman_collection.json
Tests pour les routes BAM :
- Create BAM (POST /bams)
- Get Nearby BAMs (GET /bams/nearby)
- Get BAM Details (GET /bams/:id)
- Join BAM (POST /bams/:id/join)
- Leave BAM (DELETE /bams/:id/leave)
- Add Message (POST /bams/:id/messages)

### 3. Users.postman_collection.json
Tests pour les routes utilisateurs :
- Get Profile (GET /users/profile)
- Update Profile (PUT /users/profile)
- Get User Stats (GET /users/:id/stats)

### 4. Calls.postman_collection.json
Tests pour les routes d'appels :
- Create Call (POST /calls)
- Get User Calls (GET /calls)
- Update Call Status (PUT /calls/:id)

### 5. Reviews.postman_collection.json
Tests pour les routes d'avis :
- Create Review (POST /reviews)
- Get Reviews (GET /reviews)
- Update Review (PUT /reviews/:id)

## Scripts de test automatique

### Pré-requis
Les tests utilisent des scripts Postman pour :
- Extraire automatiquement les tokens JWT après login
- Valider les réponses
- Configurer les variables pour les tests suivants

### Ordre d'exécution recommandé
1. Authentication → Register/Login pour obtenir les tokens
2. Users → Tester le profil utilisateur
3. BAMs → Créer et tester les BAMs
4. Calls → Tester les appels
5. Reviews → Tester les avis

## Tests d'intégration

### Scenario complet
1. **Inscription** : Créer un compte utilisateur
2. **Connexion** : Se connecter et récupérer les tokens
3. **Profil** : Mettre à jour le profil utilisateur
4. **BAM** : Créer une bouteille à la mer
5. **Participation** : Rejoindre une BAM existante
6. **Messages** : Envoyer des messages dans une BAM
7. **Appel** : Créer un appel vidéo
8. **Avis** : Laisser un avis sur un utilisateur

### Variables automatiques
Les scripts extraient automatiquement :
- `accessToken` et `refreshToken` après login
- `userId` depuis le profil utilisateur
- `bamId` après création d'une BAM
- `callId` après création d'un appel
- `reviewId` après création d'un avis

## Validation des réponses

Chaque test valide :
- **Status codes** : 200, 201, 400, 401, 403, 404, 409
- **Structure des réponses** : Présence des champs requis
- **Types de données** : Validation des formats (UUID, email, phone)
- **Logique métier** : Cohérence des données retournées

## Gestion des erreurs

Tests spécifiques pour :
- **Validation des données** : Champs manquants, formats invalides
- **Authentification** : Tokens invalides, expirés
- **Autorisation** : Accès non autorisé aux ressources
- **Contraintes métier** : Règles spécifiques à l'application

## Utilisation

### Test manuel
1. Importer les collections
2. Configurer l'environnement
3. Exécuter les requêtes une par une

### Test automatique
1. Utiliser Newman (CLI Postman)
```bash
npm install -g newman
newman run Authentication.postman_collection.json -e environment.json
```

### Test en CI/CD
Intégrer les tests Postman dans votre pipeline :
```bash
newman run *.postman_collection.json --reporters cli,json --reporter-json-export results.json
```