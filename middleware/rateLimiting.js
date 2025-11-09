const rateLimit = require('express-rate-limit');

// Rate limiting général
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limite chaque IP à 100 requêtes par windowMs
  message: {
    error: 'Trop de requêtes, réessayez plus tard.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting strict pour création d'utilisateurs
const userCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5, // limite à 5 créations d'utilisateur par heure par IP
  message: {
    error: 'Trop de créations d\'utilisateur, réessayez dans une heure.',
  },
});

// Rate limiting pour création de BAMs
const bamCreationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // limite à 3 BAMs par 5 minutes
  message: {
    error: 'Trop de BAMs créés, attendez 5 minutes.',
  },
});

// Rate limiting pour messages
const messageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // limite à 10 messages par minute
  message: {
    error: 'Trop de messages envoyés, ralentissez.',
  },
});

// Rate limiting pour recherche géolocalisée
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // limite à 20 recherches par minute
  message: {
    error: 'Trop de recherches, attendez une minute.',
  },
});

module.exports = {
  generalLimiter,
  userCreationLimiter,
  bamCreationLimiter,
  messageLimiter,
  searchLimiter,
};
