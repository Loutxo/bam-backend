# API Endpoints - Upload de Fichiers

## Vue d'ensemble

Les endpoints d'upload permettent de gérer les images des utilisateurs et des BAMs via Cloudinary. Les images sont automatiquement redimensionnées en plusieurs tailles et optimisées pour différents usages.

## Configuration requise

Variables d'environnement :
```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

## Formats supportés

- **Types MIME** : `image/jpeg`, `image/jpg`, `image/png`, `image/webp`, `image/gif`
- **Taille max photos de profil** : 5MB
- **Taille max images BAM** : 10MB
- **Nombre max d'images par BAM** : 3

## Endpoints

### Upload Photo de Profil

**POST** `/uploads/profile`

Upload d'une photo de profil utilisateur.

**Headers :**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data :**
- `profilePhoto` (file) - Fichier image (requis)

**Réponse Succès (200) :**
```json
{
  "success": true,
  "message": "Photo de profil uploadée avec succès",
  "data": {
    "user": {
      "id": "user-123",
      "username": "johndoe",
      "profileImageUrl": "https://res.cloudinary.com/bam-app/profiles/user-123-medium-1234567890.jpg",
      "updatedAt": "2024-01-15T10:30:00Z"
    },
    "upload": {
      "primaryUrl": "https://res.cloudinary.com/bam-app/profiles/user-123-medium-1234567890.jpg",
      "images": {
        "small": {
          "url": "https://res.cloudinary.com/bam-app/profiles/user-123-small-1234567890.jpg",
          "public_id": "bam-app/profiles/user-123-small-1234567890",
          "width": 150,
          "height": 150,
          "size": 15000
        },
        "medium": {
          "url": "https://res.cloudinary.com/bam-app/profiles/user-123-medium-1234567890.jpg",
          "public_id": "bam-app/profiles/user-123-medium-1234567890",
          "width": 300,
          "height": 300,
          "size": 35000
        },
        "large": {
          "url": "https://res.cloudinary.com/bam-app/profiles/user-123-large-1234567890.jpg",
          "public_id": "bam-app/profiles/user-123-large-1234567890",
          "width": 600,
          "height": 600,
          "size": 85000
        }
      },
      "metadata": {
        "originalSize": 1024000,
        "uploadedAt": "2024-01-15T10:30:00Z",
        "userId": "user-123"
      }
    }
  }
}
```

**Erreurs :**
- `400` - Fichier manquant, type non supporté, ou trop volumineux
- `404` - Utilisateur non trouvé
- `500` - Erreur d'upload ou de traitement

---

### Upload Image BAM

**POST** `/uploads/bam/:bamId`

Upload d'une image pour une BAM spécifique.

**Headers :**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Paramètres :**
- `bamId` (path) - ID de la BAM

**Form Data :**
- `bamImage` (file) - Fichier image (requis)

**Réponse Succès (200) :**
```json
{
  "success": true,
  "message": "Image de BAM uploadée avec succès",
  "data": {
    "bam": {
      "id": 123,
      "title": "Recherche aide jardinage",
      "description": "Besoin d'aide pour tailler mes haies",
      "imageUrl": "https://res.cloudinary.com/bam-app/bams/bam-123-medium-1234567890.jpg",
      "updatedAt": "2024-01-15T10:30:00Z",
      "user": {
        "id": "user-123",
        "username": "johndoe",
        "profileImageUrl": "https://res.cloudinary.com/bam-app/profiles/user-123-medium.jpg"
      }
    },
    "upload": {
      "primaryUrl": "https://res.cloudinary.com/bam-app/bams/bam-123-medium-1234567890.jpg",
      "thumbnailUrl": "https://res.cloudinary.com/bam-app/bams/bam-123-thumbnail-1234567890.jpg",
      "images": {
        "thumbnail": {
          "url": "https://res.cloudinary.com/bam-app/bams/bam-123-thumbnail-1234567890.jpg",
          "public_id": "bam-app/bams/bam-123-thumbnail-1234567890",
          "width": 200,
          "height": 200,
          "size": 25000
        },
        "medium": {
          "url": "https://res.cloudinary.com/bam-app/bams/bam-123-medium-1234567890.jpg",
          "public_id": "bam-app/bams/bam-123-medium-1234567890",
          "width": 800,
          "height": 600,
          "size": 120000
        },
        "large": {
          "url": "https://res.cloudinary.com/bam-app/bams/bam-123-large-1234567890.jpg",
          "public_id": "bam-app/bams/bam-123-large-1234567890",
          "width": 1200,
          "height": 900,
          "size": 250000
        }
      },
      "metadata": {
        "originalSize": 2048000,
        "uploadedAt": "2024-01-15T10:30:00Z",
        "bamId": 123,
        "userId": "user-123"
      }
    }
  }
}
```

**Erreurs :**
- `400` - Fichier manquant, type non supporté, ou trop volumineux
- `404` - BAM non trouvée ou non autorisée
- `500` - Erreur d'upload ou de traitement

---

### Upload Multiple Images BAM

**POST** `/uploads/bam/:bamId/multiple`

Upload de plusieurs images pour une BAM (maximum 3).

**Headers :**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Paramètres :**
- `bamId` (path) - ID de la BAM

**Form Data :**
- `bamImages` (file[]) - Fichiers images (1 à 3)

**Réponse Succès (200/207) :**
```json
{
  "success": true,
  "message": "3/3 images uploadées avec succès",
  "data": {
    "successful": [
      {
        "index": 0,
        "file": "image1.jpg",
        "success": true,
        "primaryUrl": "https://res.cloudinary.com/bam-app/bams/bam-123-0-medium.jpg",
        "thumbnailUrl": "https://res.cloudinary.com/bam-app/bams/bam-123-0-thumbnail.jpg",
        "images": {...},
        "metadata": {...}
      }
    ],
    "failed": [],
    "summary": {
      "total": 3,
      "successful": 3,
      "failed": 0
    }
  }
}
```

**Erreurs :**
- `400` - Aucun fichier fourni ou BAM non trouvée
- `207` - Succès partiel (certaines images ont échoué)
- `500` - Erreur générale

---

### Supprimer Photo de Profil

**DELETE** `/uploads/profile`

Supprime la photo de profil de l'utilisateur connecté.

**Headers :**
```
Authorization: Bearer <token>
```

**Réponse Succès (200) :**
```json
{
  "success": true,
  "message": "Photo de profil supprimée avec succès"
}
```

**Erreurs :**
- `404` - Aucune photo de profil à supprimer
- `500` - Erreur de suppression

---

### Supprimer Image BAM

**DELETE** `/uploads/bam/:bamId`

Supprime l'image d'une BAM.

**Headers :**
```
Authorization: Bearer <token>
```

**Paramètres :**
- `bamId` (path) - ID de la BAM

**Réponse Succès (200) :**
```json
{
  "success": true,
  "message": "Image de BAM supprimée avec succès"
}
```

**Erreurs :**
- `404` - BAM non trouvée, non autorisée, ou sans image
- `500` - Erreur de suppression

---

### Informations Image

**GET** `/uploads/info/:type/:id`

Récupère les informations d'une image uploadée.

**Headers :**
```
Authorization: Bearer <token>
```

**Paramètres :**
- `type` (path) - Type d'image (`profile` ou `bam`)
- `id` (path) - ID de l'utilisateur (pour `profile`) ou de la BAM (pour `bam`)

**Réponse Succès (200) :**
```json
{
  "success": true,
  "data": {
    "hasImage": true,
    "imageUrl": "https://res.cloudinary.com/bam-app/profiles/user-123-medium.jpg",
    "cloudinaryInfo": {
      "public_id": "bam-app/profiles/user-123-medium",
      "url": "https://res.cloudinary.com/bam-app/profiles/user-123-medium.jpg",
      "width": 300,
      "height": 300,
      "size": 50000,
      "format": "jpg",
      "created_at": "2024-01-15T10:30:00Z"
    },
    "user": {
      "id": "user-123",
      "username": "johndoe",
      "profileImageUrl": "https://res.cloudinary.com/bam-app/profiles/user-123-medium.jpg",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

**Erreurs :**
- `400` - Type invalide
- `403` - Accès non autorisé
- `404` - Utilisateur ou BAM non trouvé
- `500` - Erreur de récupération

---

### Test Connexion Cloudinary

**GET** `/uploads/test-connection`

Teste la configuration et connexion Cloudinary.

**Headers :**
```
Authorization: Bearer <token>
```

**Réponse Succès (200) :**
```json
{
  "success": true,
  "data": {
    "configurationValid": true,
    "connectionTest": {
      "success": true,
      "message": "Connexion Cloudinary OK"
    },
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

**Réponse Échec (200) :**
```json
{
  "success": false,
  "data": {
    "configurationValid": false,
    "connectionTest": {
      "success": false,
      "error": "Invalid credentials"
    },
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## Codes d'erreur

### Erreurs Multer

- `LIMIT_FILE_SIZE` - Fichier trop volumineux
- `LIMIT_FILE_COUNT` - Trop de fichiers
- `LIMIT_UNEXPECTED_FILE` - Fichier inattendu
- `FILE_VALIDATION_ERROR` - Type de fichier non autorisé

### Erreurs Upload

- `NO_FILE_PROVIDED` - Aucun fichier fourni
- `UPLOAD_FAILED` - Erreur générale d'upload
- `USER_NOT_FOUND` - Utilisateur non trouvé
- `BAM_NOT_FOUND` - BAM non trouvée ou non autorisée

### Erreurs Suppression

- `DELETE_FAILED` - Erreur de suppression
- `NO_PROFILE_IMAGE` - Aucune photo de profil à supprimer
- `NO_BAM_IMAGE` - Aucune image de BAM à supprimer

## Tailles d'images générées

### Photos de profil
- **Small** : 150x150px (pour avatars dans listes)
- **Medium** : 300x300px (affichage principal)
- **Large** : 600x600px (zoom/détail)

### Images BAM
- **Thumbnail** : 200x200px (miniatures dans listes)
- **Medium** : 800x600px (affichage principal)
- **Large** : 1200x900px (plein écran)

## Optimisations

- **Compression JPEG** : Qualité 80-90% selon la taille
- **Format automatique** : WebP si supporté par le navigateur
- **Redimensionnement intelligent** : Crop centré avec ratio préservé
- **CDN Cloudinary** : Images servies via CDN global

## Sécurité

- **Authentification requise** pour tous les endpoints
- **Validation des types MIME** côté serveur
- **Limitation de taille** par type d'image
- **Autorisation** : seul le propriétaire peut modifier ses images
- **Nettoyage automatique** des anciennes images lors du remplacement

## Exemple d'usage

```javascript
// Upload photo de profil
const formData = new FormData();
formData.append('profilePhoto', file);

const response = await fetch('/uploads/profile', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

// Upload image BAM
const formData2 = new FormData();
formData2.append('bamImage', file);

const response2 = await fetch('/uploads/bam/123', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData2
});
```