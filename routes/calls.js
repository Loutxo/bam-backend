const express = require('express');
const { PrismaClient } = require('@prisma/client');
const GamificationService = require('../services/gamificationService');
const router = express.Router();
const prisma = new PrismaClient();
const gamificationService = GamificationService; // Singleton

// POST /calls — enregistrer un appel entre 2 users pour un BAM
router.post('/', async (req, res) => {
  const { idCaller, idCalled, idBam } = req.body;
  if (!idCaller || !idCalled || !idBam) {
    return res.status(400).json({ error: 'idCaller, idCalled et idBam sont requis' });
  }

  try {
    const bam = await prisma.bam.findUnique({ where: { id: idBam } });
    if (!bam) return res.status(404).json({ error: 'BAM introuvable' });
    if (bam.expiresAt <= new Date()) return res.status(400).json({ error: 'BAM expiré' });

    // autoriser uniquement (owner <-> responder)
    const callerIsOwner = bam.userId === idCaller;
    const calledIsOwner = bam.userId === idCalled;

    const callerHasResponded = await prisma.response.findFirst({ where: { bamId: idBam, userId: idCaller }});
    const calledHasResponded = await prisma.response.findFirst({ where: { bamId: idBam, userId: idCalled }});

    const validPair =
      (callerIsOwner && calledHasResponded) ||
      (calledIsOwner && callerHasResponded);

    if (!validPair) return res.status(403).json({ error: 'Participants non autorisés pour ce BAM' });

    const call = await prisma.call.create({
      data: { bamId: idBam, fromId: idCaller, toId: idCalled },
    });

    // 🎮 Attribution des points pour appel terminé (aux deux participants)
    try {
      await gamificationService.awardPoints(
        idCaller, 
        'CALL_COMPLETED',
        null,
        'Appel effectué',
        idBam
      );
      await gamificationService.awardPoints(
        idCalled, 
        'CALL_COMPLETED',
        null,
        'Appel reçu et terminé',
        idBam
      );
      console.log(`🎯 Points attribués pour appel terminé entre ${idCaller} et ${idCalled}`);
    } catch (gamificationError) {
      console.error('Erreur gamification lors appel:', gamificationError);
    }

    res.json(call);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lors de la création de l’appel' });
  }
});

// (optionnel) lister les appels d’un BAM
router.get('/bams/:id/calls', async (req, res) => {
  try {
    const calls = await prisma.call.findMany({
      where: { bamId: req.params.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(calls);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Erreur lors de la lecture des appels' });
  }
});

module.exports = router;
