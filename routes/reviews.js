const express = require('express');
const { PrismaClient } = require('@prisma/client');
const GamificationService = require('../services/gamificationService');
const router = express.Router();
const prisma = new PrismaClient();
const gamificationService = GamificationService; // Singleton

// POST /reviews — créer une note
router.post('/', async (req, res) => {
  const { fromUserId, toUserId, bamId, rating, comment } = req.body;

  if (!fromUserId || !toUserId || rating == null) {
    return res.status(400).json({ error: 'fromUserId, toUserId et rating sont requis' });
  }
  if (rating < 0 || rating > 5) {
    return res.status(400).json({ error: 'rating doit être entre 0 et 5' });
  }

  try {
    // (optionnel) exiger un appel préalable si bamId fourni
    if (bamId) {
      const call = await prisma.call.findFirst({
        where: {
          bamId,
          OR: [
            { fromId: fromUserId, toId: toUserId },
            { fromId: toUserId, toId: fromUserId },
          ],
        },
      });
      if (!call) return res.status(400).json({ error: 'Note possible uniquement après un appel pour ce BAM' });
    }

    const review = await prisma.review.create({
      data: { fromId: fromUserId, toId: toUserId, bamId: bamId ?? null, rating, comment },
    });

    // Recalcule la moyenne "score" du noté
    const agg = await prisma.review.aggregate({
      _avg: { rating: true },
      where: { toId: toUserId },
    });
    await prisma.user.update({
      where: { id: toUserId },
      data: { score: agg._avg.rating ?? 0 },
    });

    // 🎮 Attribution des points pour donner un avis
    try {
      await gamificationService.awardPoints(
        fromUserId, 
        'REVIEW_GIVEN',
        null,
        `Avis donné à un utilisateur (${rating}/5)`,
        bamId
      );
      console.log(`🎯 Points attribués pour avis donné par ${fromUserId}`);
    } catch (gamificationError) {
      console.error('Erreur gamification lors avis:', gamificationError);
    }

    res.json(review);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lors de l’enregistrement de la note' });
  }
});

// (optionnel) lire les avis reçus d’un user
router.get('/users/:id/reviews', async (req, res) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { toId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(reviews);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lors de la lecture des avis' });
  }
});

module.exports = router;
