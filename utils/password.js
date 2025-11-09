const bcrypt = require('bcryptjs');
const { config } = require('../config');

/**
 * Utilitaires de hashage et vérification de mots de passe
 */

/**
 * Hash un mot de passe
 * @param {string} password - Mot de passe en clair
 * @returns {Promise<string>} Hash du mot de passe
 */
const hashPassword = async (password) => {
  try {
    const saltRounds = config.security?.bcryptRounds || 12;
    return await bcrypt.hash(password, saltRounds);
  } catch (error) {
    throw new Error('Erreur lors du hashage du mot de passe');
  }
};

/**
 * Vérifie un mot de passe contre son hash
 * @param {string} password - Mot de passe en clair
 * @param {string} hash - Hash à vérifier
 * @returns {Promise<boolean>} True si le mot de passe correspond
 */
const comparePassword = async (password, hash) => {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    throw new Error('Erreur lors de la vérification du mot de passe');
  }
};

/**
 * Génère un mot de passe temporaire aléatoire
 * @param {number} length - Longueur du mot de passe (défaut: 12)
 * @returns {string} Mot de passe généré
 */
const generateTemporaryPassword = (length = 12) => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';

  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return password;
};

/**
 * Valide la force d'un mot de passe
 * @param {string} password - Mot de passe à valider
 * @returns {Object} Résultat de validation avec score et suggestions
 */
const validatePasswordStrength = (password) => {
  const result = {
    isValid: false,
    score: 0,
    requirements: {
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumbers: /\d/.test(password),
      hasSpecialChars: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
    },
    suggestions: [],
  };

  // Calcul du score
  Object.values(result.requirements).forEach(requirement => {
    if (requirement) result.score += 20;
  });

  // Suggestions d'amélioration
  if (!result.requirements.minLength) {
    result.suggestions.push('Le mot de passe doit contenir au moins 8 caractères');
  }
  if (!result.requirements.hasUppercase) {
    result.suggestions.push('Ajoutez au moins une lettre majuscule');
  }
  if (!result.requirements.hasLowercase) {
    result.suggestions.push('Ajoutez au moins une lettre minuscule');
  }
  if (!result.requirements.hasNumbers) {
    result.suggestions.push('Ajoutez au moins un chiffre');
  }
  if (!result.requirements.hasSpecialChars) {
    result.suggestions.push('Ajoutez au moins un caractère spécial (!@#$%^&*...)');
  }

  // Validation globale
  result.isValid = result.score >= 80; // 4/5 critères minimum

  return result;
};

module.exports = {
  hashPassword,
  comparePassword,
  generateTemporaryPassword,
  validatePasswordStrength,
};
