const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Créer un utilisateur
router.post('/', async (req, res) => {
  const { pseudo, phone, photoUrl } = req.body;

  try {
    const user = await prisma.user.create({
      data: { pseudo, phone, photoUrl },
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
