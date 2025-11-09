const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { body } = require('express-validator');

const { hashPassword, comparePassword, validatePasswordStrength } = require('../utils/password');
const { generateToken, generateRefreshToken, verifyToken } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');
const { userCreationLimiter, generalLimiter } = require('../middleware/rateLimiting');

const prisma = new PrismaClient();

// Validation pour l'inscription
const validateRegister = [
  body('pseudo')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Le pseudo doit contenir entre 2 et 50 caractères')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Le pseudo ne peut contenir que des lettres, chiffres, tirets et underscores'),

  body('phone')
    .isMobilePhone('fr-FR')
    .withMessage('Numéro de téléphone invalide'),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Le mot de passe doit contenir au moins 8 caractères')
    .custom((password) => {
      const validation = validatePasswordStrength(password);
      if (!validation.isValid) {
        throw new Error(`Mot de passe trop faible: ${validation.suggestions.join(', ')}`);
      }
      return true;
    }),

  body('profileImageUrl')
    .optional()
    .isURL()
    .withMessage('URL de photo de profil invalide'),
];

// Validation pour la connexion
const validateLogin = [
  body('phone')
    .isMobilePhone('fr-FR')
    .withMessage('Numéro de téléphone invalide'),

  body('password')
    .notEmpty()
    .withMessage('Mot de passe requis'),
];

// POST /auth/register - Inscription
router.post('/register', userCreationLimiter, validateRegister, handleValidationErrors, async (req, res) => {
  const { pseudo, phone, password, profileImageUrl } = req.body;

  try {
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { phone },
    });

    if (existingUser) {
      return res.status(409).json({
        error: 'Utilisateur existant',
        message: 'Un compte avec ce numéro de téléphone existe déjà',
      });
    }

    // Hasher le mot de passe
    const hashedPassword = await hashPassword(password);

    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: {
        pseudo,
        phone,
        password: hashedPassword,
        profileImageUrl,
      },
      select: {
        id: true,
        pseudo: true,
        phone: true,
        profileImageUrl: true,
        createdAt: true,
      },
    });

    // Générer les tokens
    const token = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    res.status(201).json({
      message: 'Compte créé avec succès',
      user,
      tokens: {
        access: token,
        refresh: refreshToken,
      },
    });
  } catch (error) {
    console.error('Erreur inscription:', error);
    res.status(500).json({
      error: 'Erreur lors de la création du compte',
      message: 'Une erreur inattendue s\'est produite',
    });
  }
});

// POST /auth/login - Connexion
router.post('/login', generalLimiter, validateLogin, handleValidationErrors, async (req, res) => {
  const { phone, password } = req.body;

  try {
    // Trouver l'utilisateur
    const user = await prisma.user.findUnique({
      where: { phone },
    });

    if (!user || !user.password) {
      return res.status(401).json({
        error: 'Identifiants invalides',
        message: 'Numéro de téléphone ou mot de passe incorrect',
      });
    }

    // Vérifier le mot de passe
    const isValidPassword = await comparePassword(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Identifiants invalides',
        message: 'Numéro de téléphone ou mot de passe incorrect',
      });
    }

    // Générer les tokens
    const userForToken = {
      id: user.id,
      pseudo: user.pseudo,
      phone: user.phone,
    };

    const token = generateToken(userForToken);
    const refreshToken = generateRefreshToken(userForToken);

    // Mettre à jour la dernière connexion
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    res.json({
      message: 'Connexion réussie',
      user: {
        id: user.id,
        pseudo: user.pseudo,
        phone: user.phone,
        profileImageUrl: user.profileImageUrl,
        score: user.score,
      },
      tokens: {
        access: token,
        refresh: refreshToken,
      },
    });
  } catch (error) {
    console.error('Erreur connexion:', error);
    res.status(500).json({
      error: 'Erreur lors de la connexion',
      message: 'Une erreur inattendue s\'est produite',
    });
  }
});

// POST /auth/refresh - Rafraîchissement du token
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({
      error: 'Refresh token requis',
      message: 'Token de rafraîchissement manquant',
    });
  }

  try {
    const decoded = verifyToken(refreshToken);

    if (decoded.type !== 'refresh') {
      return res.status(403).json({
        error: 'Token invalide',
        message: 'Ce n\'est pas un refresh token valide',
      });
    }

    // Vérifier que l'utilisateur existe toujours
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      return res.status(403).json({
        error: 'Utilisateur non trouvé',
        message: 'L\'utilisateur associé au token n\'existe plus',
      });
    }

    // Générer de nouveaux tokens
    const userForToken = {
      id: user.id,
      pseudo: user.pseudo,
      phone: user.phone,
    };

    const newToken = generateToken(userForToken);
    const newRefreshToken = generateRefreshToken(userForToken);

    res.json({
      tokens: {
        access: newToken,
        refresh: newRefreshToken,
      },
    });
  } catch (error) {
    return res.status(403).json({
      error: 'Refresh token invalide',
      message: 'Le token de rafraîchissement est expiré ou invalide',
    });
  }
});

// POST /auth/logout - Déconnexion (placeholder pour blacklist future)
router.post('/logout', (req, res) => {
  // Note: Avec JWT, la déconnexion côté serveur nécessite une blacklist
  // Pour l'instant, on indique juste au client de supprimer le token
  res.json({
    message: 'Déconnexion réussie',
    note: 'Supprimez le token côté client',
  });
});

module.exports = router;
