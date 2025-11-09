const { PrismaClient } = require('@prisma/client');
const { hashPassword } = require('../utils/password');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  try {
    // Créer des utilisateurs de test
    const testUser1Password = await hashPassword('TestPassword123!');
    const testUser2Password = await hashPassword('SecurePass456@');

    const user1 = await prisma.user.create({
      data: {
        pseudo: 'testuser1',
        phone: '+33123456789',
        password: testUser1Password,
        photoUrl: 'https://images.unsplash.com/photo-1494790108755-2616b612b830?w=150&h=150&fit=crop&crop=face',
        score: 85,
      },
    });

    const user2 = await prisma.user.create({
      data: {
        pseudo: 'testuser2',
        phone: '+33987654321',
        password: testUser2Password,
        photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
        score: 92,
      },
    });

    console.log('✅ Utilisateurs créés:', { user1: user1.pseudo, user2: user2.pseudo });

    // Créer des BAMs de test
    const bam1 = await prisma.bAM.create({
      data: {
        title: 'Découverte de Paris',
        description: 'Une aventure urbaine au cœur de la capitale française. Rejoignez-nous pour explorer les quartiers cachés de Paris.',
        latitude: 48.8566,
        longitude: 2.3522,
        maxParticipants: 5,
        isPublic: true,
        creatorId: user1.id,
        participants: {
          connect: [{ id: user1.id }],
        },
      },
    });

    const bam2 = await prisma.bAM.create({
      data: {
        title: 'Randonnée en Montagne',
        description: 'Une expédition en haute montagne pour les amateurs de nature et d\'aventure. Niveau intermédiaire requis.',
        latitude: 45.8326,
        longitude: 6.8652,
        maxParticipants: 8,
        isPublic: true,
        creatorId: user2.id,
        participants: {
          connect: [{ id: user2.id }],
        },
      },
    });

    const bam3 = await prisma.bAM.create({
      data: {
        title: 'Soirée Jeux de Société',
        description: 'Une soirée conviviale autour de jeux de plateau modernes. Tous niveaux bienvenus !',
        latitude: 43.2965,
        longitude: 5.3698,
        maxParticipants: 6,
        isPublic: true,
        creatorId: user1.id,
        participants: {
          connect: [{ id: user1.id }, { id: user2.id }],
        },
      },
    });

    console.log('✅ BAMs créées:', {
      bam1: bam1.title,
      bam2: bam2.title,
      bam3: bam3.title,
    });

    // Créer des messages de test
    const messages = await Promise.all([
      prisma.message.create({
        data: {
          content: 'Salut tout le monde ! J\'ai hâte de commencer cette aventure parisienne.',
          bamId: bam1.id,
          userId: user1.id,
        },
      }),
      prisma.message.create({
        data: {
          content: 'Cette randonnée s\'annonce fantastique ! Qui a déjà de l\'expérience en montagne ?',
          bamId: bam2.id,
          userId: user2.id,
        },
      }),
      prisma.message.create({
        data: {
          content: 'J\'apporte mes jeux favoris ! Quelqu\'un connaît Splendor ?',
          bamId: bam3.id,
          userId: user1.id,
        },
      }),
      prisma.message.create({
        data: {
          content: 'Oui, j\'adore Splendor ! Et que pensez-vous de Azul ?',
          bamId: bam3.id,
          userId: user2.id,
        },
      }),
    ]);

    console.log('✅ Messages créés:', messages.length);

    // Créer des appels de test
    const call1 = await prisma.call.create({
      data: {
        callerId: user1.id,
        receiverId: user2.id,
        bamId: bam3.id,
        status: 'COMPLETED',
        startedAt: new Date(Date.now() - 3600000), // Il y a 1 heure
        endedAt: new Date(Date.now() - 3000000),   // Il y a 50 minutes
      },
    });

    const call2 = await prisma.call.create({
      data: {
        callerId: user2.id,
        receiverId: user1.id,
        bamId: bam1.id,
        status: 'PENDING',
      },
    });

    console.log('✅ Appels créés:', { call1: call1.status, call2: call2.status });

    // Créer des avis de test
    const review1 = await prisma.review.create({
      data: {
        rating: 5,
        comment: 'Excellente expérience ! Très sympa et organisé.',
        reviewerId: user2.id,
        reviewedId: user1.id,
        bamId: bam3.id,
      },
    });

    const review2 = await prisma.review.create({
      data: {
        rating: 4,
        comment: 'Bonne communication, personne fiable. Je recommande !',
        reviewerId: user1.id,
        reviewedId: user2.id,
        bamId: bam3.id,
      },
    });

    console.log('✅ Avis créés:', { review1: review1.rating, review2: review2.rating });

    console.log('🎉 Database seeded successfully!');
    console.log('\n📊 Données créées:');
    console.log(`   - ${await prisma.user.count()} utilisateurs`);
    console.log(`   - ${await prisma.bAM.count()} BAMs`);
    console.log(`   - ${await prisma.message.count()} messages`);
    console.log(`   - ${await prisma.call.count()} appels`);
    console.log(`   - ${await prisma.review.count()} avis`);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
