const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Import des routes
const userRoutes = require('./routes/users');
const bamRoutes = require('./routes/bams');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Toutes les 5 minutes, supprime les messages liés à des BAM expirés
setInterval(async () => {
  try {
    // Effacer messages dont le BAM est expiré
    await prisma.$executeRawUnsafe(`
      DELETE FROM "Message" m
      USING "Bam" b
      WHERE m."bamId" = b."id"
        AND b."expiresAt" < NOW();
    `);

    // (Optionnel) Effacer messages vieux de > 1h
    // await prisma.message.deleteMany({
    //   where: { createdAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } }
    // });

  } catch (e) {
    console.error('[cleanup] error:', e);
  }
}, 5 * 60 * 1000);


// Routing
app.use('/users', userRoutes);
app.use('/bams', bamRoutes);

app.get('/', (req, res) => {
  res.send('🧭 BAM API is running');
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
