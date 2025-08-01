const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Créer un BAM
router.post('/', async (req, res) => {
  const { userId, text, price, latitude, longitude, expiresInMinutes } = req.body;

  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresInMinutes * 60000);

    const bam = await prisma.bam.create({
      data: {
        userId,
        text,
        price,
        latitude,
        longitude,
        createdAt: now,
        expiresAt,
      },
    });

    res.json(bam);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Erreur lors de la création du BAM' });
  }
});

module.exports = router;

//Voir les BAMs autour de soi
const getDistanceInKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371; // Rayon de la Terre en km

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

router.get('/nearby', async (req, res) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: 'Paramètres lat et lng requis' });
  }

  try {
    const bams = await prisma.bam.findMany({
      where: {
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        user: true
      }
    });

    const filtered = bams.filter(bam =>
      getDistanceInKm(parseFloat(lat), parseFloat(lng), bam.latitude, bam.longitude) <= 2
    );

    res.json(filtered);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la recherche de BAMs' });
  }

  });

//Répondre à un BAM
router.post('/:id/respond', async (req, res) => {
  const bamId = req.params.id;
  const { userId } = req.body;

  try {
    // Vérifie que le BAM existe
    const bam = await prisma.bam.findUnique({
      where: { id: bamId },
    });

    if (!bam) {
      return res.status(404).json({ error: 'BAM non trouvé' });
    }

    // Vérifie que la réponse n'existe pas déjà pour ce user
    const existing = await prisma.response.findFirst({
      where: { bamId, userId }
    });

    if (existing) {
      return res.status(400).json({ error: 'Vous avez déjà répondu à ce BAM' });
    }

    // Crée la réponse
    const response = await prisma.response.create({
      data: {
        bamId,
        userId
      }
    });

    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la réponse au BAM' });
  }
});

// Voir les réponses à un BAM
router.get('/:id/responses', async (req, res) => {
  const bamId = req.params.id;

  try {
    const responses = await prisma.response.findMany({
      where: { bamId },
      include: {
        user: true // Pour afficher le pseudo et la photo
      }
    });

    res.json(responses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erreur lors de la récupération des réponses' });
  }
});



