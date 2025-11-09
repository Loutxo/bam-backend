const multer = require('multer');
const path = require('path');

// Configuration du stockage en mémoire (pour Cloudinary)
const storage = multer.memoryStorage();

// Fonction de filtrage des fichiers
const fileFilter = (req, file, cb) => {
  // Types MIME autorisés pour les images
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/webp',
    'image/gif'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const error = new Error(`Type de fichier non autorisé: ${file.mimetype}. Types acceptés: ${allowedMimeTypes.join(', ')}`);
    error.statusCode = 400;
    cb(error, false);
  }
};

// Configuration générale de Multer
const multerConfig = {
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 5, // Maximum 5 fichiers en une fois
    fieldSize: 1024 * 1024, // 1MB pour les champs texte
  }
};

// Middleware pour photo de profil (1 seul fichier)
const uploadProfilePhoto = multer({
  ...multerConfig,
  limits: {
    ...multerConfig.limits,
    fileSize: 5 * 1024 * 1024, // 5MB pour les photos de profil
    files: 1
  }
}).single('profilePhoto');

// Middleware pour images de BAM (jusqu'à 3 images)
const uploadBamImages = multer({
  ...multerConfig,
  limits: {
    ...multerConfig.limits,
    files: 3 // Maximum 3 images par BAM
  }
}).array('bamImages', 3);

// Middleware pour une seule image de BAM
const uploadBamImage = multer({
  ...multerConfig,
  limits: {
    ...multerConfig.limits,
    files: 1
  }
}).single('bamImage');

// Middleware générique pour images multiples
const uploadMultipleImages = (fieldName, maxCount = 5) => {
  return multer({
    ...multerConfig,
    limits: {
      ...multerConfig.limits,
      files: maxCount
    }
  }).array(fieldName, maxCount);
};

// Middleware pour champs multiples (profil + BAM)
const uploadMixedImages = multer({
  ...multerConfig
}).fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'bamImages', maxCount: 3 },
  { name: 'coverImage', maxCount: 1 }
]);

// Gestionnaire d'erreurs spécifique à Multer
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    let message = 'Erreur lors de l\'upload du fichier';
    let statusCode = 400;

    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        message = `Fichier trop volumineux. Taille maximale autorisée: ${error.field === 'profilePhoto' ? '5MB' : '10MB'}`;
        break;
      case 'LIMIT_FILE_COUNT':
        message = `Trop de fichiers. Maximum autorisé: ${error.limit}`;
        break;
      case 'LIMIT_FIELD_KEY':
        message = 'Nom de champ trop long';
        break;
      case 'LIMIT_FIELD_VALUE':
        message = 'Valeur de champ trop longue';
        break;
      case 'LIMIT_FIELD_COUNT':
        message = 'Trop de champs dans la requête';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = `Fichier inattendu dans le champ: ${error.field}`;
        break;
      case 'LIMIT_PART_COUNT':
        message = 'Trop de parties dans la requête multipart';
        break;
      default:
        message = `Erreur Multer: ${error.message}`;
    }

    return res.status(statusCode).json({
      success: false,
      error: 'UPLOAD_ERROR',
      message,
      details: {
        code: error.code,
        field: error.field,
        limit: error.limit
      }
    });
  }

  // Autres erreurs de validation de fichiers
  if (error.statusCode === 400) {
    return res.status(400).json({
      success: false,
      error: 'FILE_VALIDATION_ERROR',
      message: error.message
    });
  }

  // Passer à l'middleware d'erreur suivant
  next(error);
};

// Middleware de validation post-upload
const validateUploadedFiles = (req, res, next) => {
  // Vérifier si des fichiers ont été uploadés
  const hasFiles = req.file || (req.files && (Array.isArray(req.files) ? req.files.length > 0 : Object.keys(req.files).length > 0));
  
  if (!hasFiles) {
    return res.status(400).json({
      success: false,
      error: 'NO_FILE_PROVIDED',
      message: 'Aucun fichier fourni pour l\'upload'
    });
  }

  // Validation supplémentaire si nécessaire
  if (req.file) {
    // Validation pour un seul fichier
    req.uploadInfo = {
      type: 'single',
      file: req.file,
      count: 1
    };
  } else if (Array.isArray(req.files)) {
    // Validation pour un array de fichiers
    req.uploadInfo = {
      type: 'array',
      files: req.files,
      count: req.files.length
    };
  } else if (req.files && typeof req.files === 'object') {
    // Validation pour des champs multiples
    req.uploadInfo = {
      type: 'fields',
      files: req.files,
      fields: Object.keys(req.files)
    };
  }

  next();
};

// Helper pour nettoyer les fichiers temporaires en cas d'erreur
const cleanupFiles = (req) => {
  // Avec memoryStorage, pas de fichiers à nettoyer
  // Mais on peut log les erreurs
  if (req.file || req.files) {
    console.log('Nettoyage des fichiers après erreur d\'upload');
  }
};

// Wrapper pour ajouter la gestion d'erreurs automatique
const wrapUploadMiddleware = (uploadMiddleware) => {
  return (req, res, next) => {
    uploadMiddleware(req, res, (error) => {
      if (error) {
        cleanupFiles(req);
        return handleMulterError(error, req, res, next);
      }
      next();
    });
  };
};

// Middlewares wrappés avec gestion d'erreurs
module.exports = {
  // Middlewares principaux
  uploadProfilePhoto: wrapUploadMiddleware(uploadProfilePhoto),
  uploadBamImage: wrapUploadMiddleware(uploadBamImage),
  uploadBamImages: wrapUploadMiddleware(uploadBamImages),
  uploadMixedImages: wrapUploadMiddleware(uploadMixedImages),
  
  // Middlewares personnalisables
  uploadMultiple: (fieldName, maxCount) => wrapUploadMiddleware(uploadMultipleImages(fieldName, maxCount)),
  
  // Middlewares utilitaires
  validateUploadedFiles,
  handleMulterError,
  
  // Configuration brute (pour usage avancé)
  multerConfig,
  
  // Helpers
  cleanupFiles
};