const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { validateUserCreation, handleValidationErrors } = require('../middleware/validation');
const { userCreationLimiter } = require('../middleware/rateLimiting');

const prisma = new PrismaClient();

// Créer un utilisateur
router.post('/', userCreationLimiter, validateUserCreation, handleValidationErrors, async (req, res) => {
  const { pseudo, phone, profileImageUrl } = req.body;

  try {
    const user = await prisma.user.create({
      data: { pseudo, phone, profileImageUrl },
    });
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Utilisateur déjà existant ou invalide' });
  }
});

// Lister les utilisateurs
router.get('/', async (req, res) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

module.exports = router;
