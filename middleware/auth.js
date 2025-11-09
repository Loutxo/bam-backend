const jwt = require('jsonwebtoken');
const { config } = require('../config');

/**
 * Middleware d'authentification JWT
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: 'Token d\'accès requis',
      message: 'Vous devez être connecté pour accéder à cette ressource',
    });
  }

  jwt.verify(token, config.jwt.secret, (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Token expiré',
          message: 'Votre session a expiré, veuillez vous reconnecter',
        });
      }
      if (err.name === 'JsonWebTokenError') {
        return res.status(403).json({
          error: 'Token invalide',
          message: 'Le token fourni est invalide',
        });
      }
      return res.status(403).json({
        error: 'Erreur d\'authentification',
        message: 'Impossible de valider le token',
      });
    }

    // Ajouter les infos utilisateur à la requête
    req.user = decoded;
    next();
  });
};

/**
 * Middleware d'authentification optionnel
 * N'échoue pas si pas de token, mais ajoute user si token valide
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, config.jwt.secret, (err, decoded) => {
    if (err) {
      req.user = null;
    } else {
      req.user = decoded;
    }
    next();
  });
};

/**
 * Génère un JWT pour un utilisateur
 */
const generateToken = (user) => {
  const payload = {
    id: user.id,
    pseudo: user.pseudo,
    phone: user.phone,
  };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
    issuer: 'bam-api',
    subject: user.id,
  });
};

/**
 * Génère un refresh token (plus longue durée)
 */
const generateRefreshToken = (user) => {
  const payload = {
    id: user.id,
    type: 'refresh',
  };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: '30d',
    issuer: 'bam-api',
    subject: user.id,
  });
};

/**
 * Vérifie et décode un token sans middleware Express
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    throw new Error('Token invalide');
  }
};

/**
 * Middleware pour vérifier que l'utilisateur authentifié est le propriétaire de la ressource
 */
const requireOwnership = (resourceUserIdField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentification requise',
        message: 'Vous devez être connecté',
      });
    }

    // Vérifier dans les paramètres de route
    if (req.params.userId && req.params.userId !== req.user.id) {
      return res.status(403).json({
        error: 'Accès refusé',
        message: 'Vous ne pouvez accéder qu\'à vos propres ressources',
      });
    }

    // Vérifier dans le body de la requête
    if (req.body[resourceUserIdField] && req.body[resourceUserIdField] !== req.user.id) {
      return res.status(403).json({
        error: 'Accès refusé',
        message: 'Vous ne pouvez modifier que vos propres ressources',
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  optionalAuth,
  generateToken,
  generateRefreshToken,
  verifyToken,
  requireOwnership,
};
