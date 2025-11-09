const { body, validationResult } = require('express-validator');

// Validation pour création d'utilisateur
const validateUserCreation = [
  body('pseudo')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Le pseudo doit contenir entre 2 et 50 caractères')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Le pseudo ne peut contenir que des lettres, chiffres, tirets et underscores'),

  body('phone')
    .isMobilePhone('fr-FR')
    .withMessage('Numéro de téléphone invalide'),

  body('profileImageUrl')
    .optional()
    .isURL()
    .withMessage('URL de photo de profil invalide'),
];

// Validation pour création de BAM
const validateBamCreation = [
  body('text')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('La description doit contenir entre 10 et 500 caractères'),

  body('price')
    .isFloat({ min: 0 })
    .withMessage('Le prix doit être positif'),

  body('latitude')
    .isFloat({ min: -90, max: 90 })
    .withMessage('Latitude invalide'),

  body('longitude')
    .isFloat({ min: -180, max: 180 })
    .withMessage('Longitude invalide'),

  body('expiresInMinutes')
    .isInt({ min: 5, max: 1440 })
    .withMessage('La durée d\'expiration doit être entre 5 minutes et 24h'),
];

// Validation pour messages
const validateMessage = [
  body('toUserId')
    .isUUID()
    .withMessage('ID destinataire invalide'),

  body('text')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Le message doit contenir entre 1 et 1000 caractères'),
];

// Validation pour reviews
const validateReview = [
  body('fromUserId')
    .isUUID()
    .withMessage('ID évaluateur invalide'),

  body('toUserId')
    .isUUID()
    .withMessage('ID évalué invalide'),

  body('rating')
    .isFloat({ min: 0, max: 5 })
    .withMessage('La note doit être entre 0 et 5'),

  body('comment')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Le commentaire ne peut dépasser 500 caractères'),
];

// Middleware pour gérer les erreurs de validation
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Données invalides',
      details: errors.array(),
    });
  }
  next();
};

module.exports = {
  validateUserCreation,
  validateBamCreation,
  validateMessage,
  validateReview,
  handleValidationErrors,
};
