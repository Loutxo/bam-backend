const { PrismaClient } = require('@prisma/client');

/**
 * Service de Gamification - Système de points, badges et achievements
 * Singleton pattern pour gérer la gamification de l'application
 */
class GamificationService {
  constructor() {
    if (GamificationService.instance) {
      return GamificationService.instance;
    }

    this.prisma = new PrismaClient();
    // Injection de dépendance pour le WebSocketService
    this.webSocketService = null;
    GamificationService.instance = this;
  }

  /**
   * Injecte le service WebSocket pour les notifications temps réel
   */
  setWebSocketService(webSocketService) {
    this.webSocketService = webSocketService;
  }

  /**
   * Configuration des points par action
   */
  static POINT_VALUES = {
    BAM_CREATED: 10,
    BAM_JOINED: 5,
    MESSAGE_SENT: 1,
    CALL_COMPLETED: 15,
    REVIEW_GIVEN: 5,
    DAILY_LOGIN: 2,
    FIRST_BAM: 50,
    SOCIAL_BUTTERFLY: 100
  };

  /**
   * Configuration des niveaux (basés sur points totaux)
   */
  static LEVEL_THRESHOLDS = [
    { level: 1, minPoints: 0 },
    { level: 2, minPoints: 50 },
    { level: 3, minPoints: 150 },
    { level: 4, minPoints: 300 },
    { level: 5, minPoints: 500 },
    { level: 6, minPoints: 750 },
    { level: 7, minPoints: 1000 },
    { level: 8, minPoints: 1500 },
    { level: 9, minPoints: 2000 },
    { level: 10, minPoints: 3000 }
  ];

  // ===========================================
  // GESTION DES POINTS
  // ===========================================

  /**
   * Attribue des points à un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {string} reason - Type de transaction (enum PointTransactionType)
   * @param {number} customPoints - Points personnalisés (optionnel)
   * @param {string} description - Description personnalisée
   * @param {string} relatedId - ID de l'entité liée
   * @returns {Object} Résultat avec points attribués et nouveau niveau
   */
  async awardPoints(userId, reason, customPoints = null, description = null, relatedId = null) {
    try {
      const points = customPoints || GamificationService.POINT_VALUES[reason] || 0;
      
      if (points === 0) {
        console.warn(`Aucun point configuré pour l'action: ${reason}`);
        return { success: false, error: 'Action non récompensée' };
      }

      // Créer la transaction de points
      const transaction = await this.prisma.pointTransaction.create({
        data: {
          userId,
          points,
          reason,
          description: description || this.getDefaultDescription(reason, points),
          relatedId
        }
      });

      // Mettre à jour les points totaux de l'utilisateur
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          totalPoints: {
            increment: points
          }
        },
        select: {
          id: true,
          pseudo: true,
          totalPoints: true,
          currentLevel: true
        }
      });

      // Vérifier si l'utilisateur monte de niveau
      const newLevel = this.calculateLevel(user.totalPoints);
      let levelChanged = false;

      if (newLevel > user.currentLevel) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { currentLevel: newLevel }
        });
        levelChanged = true;
      }

      // Vérifier les achievements et badges automatiques
      await this.checkAndAwardBadges(userId, reason);
      await this.updateAchievementProgress(userId, reason);

      console.log(`💎 ${user.pseudo} a gagné ${points} points pour: ${reason}`);

      return {
        success: true,
        transaction,
        totalPoints: user.totalPoints + points,
        previousLevel: user.currentLevel,
        newLevel: newLevel,
        levelChanged,
        pointsAwarded: points
      };

    } catch (error) {
      console.error('Erreur attribution points:', error);
      throw new Error(`Erreur lors de l'attribution des points: ${error.message}`);
    }
  }

  /**
   * Calcule le niveau basé sur les points totaux
   * @param {number} totalPoints - Points totaux de l'utilisateur
   * @returns {number} Niveau calculé
   */
  calculateLevel(totalPoints) {
    for (let i = GamificationService.LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (totalPoints >= GamificationService.LEVEL_THRESHOLDS[i].minPoints) {
        return GamificationService.LEVEL_THRESHOLDS[i].level;
      }
    }
    return 1;
  }

  /**
   * Récupère les statistiques de points d'un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @returns {Object} Statistiques détaillées
   */
  async getUserPointsStats(userId) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          pseudo: true,
          totalPoints: true,
          currentLevel: true,
          pointHistory: {
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: {
              id: true,
              points: true,
              reason: true,
              description: true,
              createdAt: true
            }
          }
        }
      });

      if (!user) {
        throw new Error('Utilisateur non trouvé');
      }

      const currentLevel = user.currentLevel;
      const nextLevel = currentLevel + 1;
      const currentLevelThreshold = GamificationService.LEVEL_THRESHOLDS.find(l => l.level === currentLevel);
      const nextLevelThreshold = GamificationService.LEVEL_THRESHOLDS.find(l => l.level === nextLevel);

      const pointsToNextLevel = nextLevelThreshold 
        ? nextLevelThreshold.minPoints - user.totalPoints
        : 0;

      return {
        user: {
          id: user.id,
          pseudo: user.pseudo,
          totalPoints: user.totalPoints,
          currentLevel: user.currentLevel
        },
        progression: {
          currentLevel,
          nextLevel: nextLevelThreshold ? nextLevel : null,
          pointsToNextLevel: Math.max(0, pointsToNextLevel),
          progressPercentage: nextLevelThreshold 
            ? Math.floor(((user.totalPoints - currentLevelThreshold.minPoints) / (nextLevelThreshold.minPoints - currentLevelThreshold.minPoints)) * 100)
            : 100
        },
        recentTransactions: user.pointHistory
      };

    } catch (error) {
      console.error('Erreur récupération stats points:', error);
      throw error;
    }
  }

  // ===========================================
  // GESTION DES BADGES
  // ===========================================

  /**
   * Vérifie et attribue automatiquement les badges basés sur une action
   * @param {string} userId - ID de l'utilisateur
   * @param {string} actionType - Type d'action effectuée
   */
  async checkAndAwardBadges(userId, actionType) {
    try {
      const badgeChecks = {
        'BAM_CREATED': async () => await this.checkFirstBamBadge(userId),
        'BAM_JOINED': async () => await this.checkSocialButterflyBadge(userId),
        'MESSAGE_SENT': async () => await this.checkCommunicatorBadge(userId),
        'CALL_COMPLETED': async () => await this.checkCallerBadge(userId)
      };

      if (badgeChecks[actionType]) {
        await badgeChecks[actionType]();
      }

    } catch (error) {
      console.error('Erreur vérification badges:', error);
    }
  }

  /**
   * Attribue un badge à un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {string} badgeName - Nom du badge
   * @returns {Object} Résultat de l'attribution
   */
  async awardBadge(userId, badgeName) {
    try {
      // Vérifier si le badge existe
      const badge = await this.prisma.badge.findUnique({
        where: { name: badgeName }
      });

      if (!badge) {
        throw new Error(`Badge '${badgeName}' non trouvé`);
      }

      // Vérifier si l'utilisateur a déjà ce badge
      const existingUserBadge = await this.prisma.userBadge.findUnique({
        where: {
          userId_badgeId: {
            userId,
            badgeId: badge.id
          }
        }
      });

      if (existingUserBadge) {
        return { success: false, error: 'Badge déjà possédé' };
      }

      // Attribuer le badge
      const userBadge = await this.prisma.userBadge.create({
        data: {
          userId,
          badgeId: badge.id
        },
        include: {
          badge: true
        }
      });

      // Attribuer les points bonus du badge
      if (badge.pointsReward > 0) {
        await this.awardPoints(
          userId, 
          'BONUS', 
          badge.pointsReward, 
          `Bonus badge: ${badge.name}`,
          badge.id
        );
      }

      console.log(`🏆 Badge '${badge.name}' attribué à l'utilisateur ${userId}`);

      return {
        success: true,
        badge: userBadge.badge,
        earnedAt: userBadge.earnedAt,
        pointsAwarded: badge.pointsReward
      };

    } catch (error) {
      console.error('Erreur attribution badge:', error);
      throw error;
    }
  }

  // ===========================================
  // VÉRIFICATIONS SPÉCIFIQUES DE BADGES
  // ===========================================

  async checkFirstBamBadge(userId) {
    const bamCount = await this.prisma.bam.count({
      where: { userId }
    });

    if (bamCount === 1) {
      await this.awardBadge(userId, 'Premier Pas');
    }
  }

  async checkSocialButterflyBadge(userId) {
    const responseCount = await this.prisma.response.count({
      where: { userId }
    });

    if (responseCount >= 10) {
      await this.awardBadge(userId, 'Social Butterfly');
    }
  }

  async checkCommunicatorBadge(userId) {
    const messageCount = await this.prisma.message.count({
      where: { fromUserId: userId }
    });

    if (messageCount >= 100) {
      await this.awardBadge(userId, 'Grand Communicateur');
    }
  }

  async checkCallerBadge(userId) {
    const callCount = await this.prisma.call.count({
      where: { fromId: userId }
    });

    if (callCount >= 5) {
      await this.awardBadge(userId, 'Bavard');
    }
  }

  // ===========================================
  // GESTION DES ACHIEVEMENTS
  // ===========================================

  /**
   * Met à jour la progression d'un achievement pour un utilisateur
   * @param {string} userId - ID de l'utilisateur
   * @param {string} actionType - Type d'action effectuée
   */
  async updateAchievementProgress(userId, actionType) {
    try {
      // Mapping des actions vers les catégories d'achievements
      const actionCategories = {
        'BAM_CREATED': 'CREATION',
        'BAM_JOINED': 'PARTICIPATION',
        'MESSAGE_SENT': 'COMMUNICATION',
        'CALL_COMPLETED': 'COMMUNICATION'
      };

      const category = actionCategories[actionType];
      if (!category) return;

      // Récupérer les achievements actifs de cette catégorie
      const achievements = await this.prisma.achievement.findMany({
        where: { 
          category,
          isActive: true
        }
      });

      for (const achievement of achievements) {
        await this.updateSpecificAchievement(userId, achievement.id, actionType);
      }

    } catch (error) {
      console.error('Erreur mise à jour achievements:', error);
    }
  }

  /**
   * Met à jour un achievement spécifique
   * @param {string} userId - ID de l'utilisateur
   * @param {string} achievementId - ID de l'achievement
   * @param {string} actionType - Type d'action
   */
  async updateSpecificAchievement(userId, achievementId, actionType) {
    try {
      // Récupérer ou créer l'achievement utilisateur
      let userAchievement = await this.prisma.userAchievement.findUnique({
        where: {
          userId_achievementId: {
            userId,
            achievementId
          }
        },
        include: {
          achievement: true
        }
      });

      if (!userAchievement) {
        userAchievement = await this.prisma.userAchievement.create({
          data: {
            userId,
            achievementId,
            progress: 0
          },
          include: {
            achievement: true
          }
        });
      }

      // Si déjà complété, ne rien faire
      if (userAchievement.completed) return;

      // Incrémenter la progression
      const newProgress = userAchievement.progress + 1;
      const isCompleted = newProgress >= userAchievement.achievement.target;

      await this.prisma.userAchievement.update({
        where: { id: userAchievement.id },
        data: {
          progress: newProgress,
          completed: isCompleted,
          completedAt: isCompleted ? new Date() : null
        }
      });

      // Si achievement complété, attribuer les récompenses
      if (isCompleted) {
        console.log(`🎯 Achievement '${userAchievement.achievement.name}' complété par l'utilisateur ${userId}`);
        
        // Points de récompense
        if (userAchievement.achievement.pointsReward > 0) {
          await this.awardPoints(
            userId,
            'BONUS',
            userAchievement.achievement.pointsReward,
            `Achievement: ${userAchievement.achievement.name}`,
            achievementId
          );
        }

        // Badge de récompense
        if (userAchievement.achievement.badgeReward) {
          const badge = await this.prisma.badge.findUnique({
            where: { id: userAchievement.achievement.badgeReward }
          });
          if (badge) {
            await this.awardBadge(userId, badge.name);
          }
        }
      }

    } catch (error) {
      console.error('Erreur mise à jour achievement spécifique:', error);
    }
  }

  // ===========================================
  // LEADERBOARDS
  // ===========================================

  /**
   * Récupère le classement global des points
   * @param {number} limit - Nombre d'utilisateurs à retourner
   * @param {number} offset - Décalage pour pagination
   * @returns {Array} Liste des utilisateurs classés
   */
  async getPointsLeaderboard(limit = 10, offset = 0) {
    try {
      const users = await this.prisma.user.findMany({
        select: {
          id: true,
          pseudo: true,
          totalPoints: true,
          currentLevel: true,
          profileImageUrl: true
        },
        orderBy: {
          totalPoints: 'desc'
        },
        take: limit,
        skip: offset
      });

      return users.map((user, index) => ({
        rank: offset + index + 1,
        user
      }));

    } catch (error) {
      console.error('Erreur récupération leaderboard:', error);
      throw error;
    }
  }

  /**
   * Récupère la position d'un utilisateur dans le classement
   * @param {string} userId - ID de l'utilisateur
   * @returns {Object} Position et informations de l'utilisateur
   */
  async getUserRank(userId) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          pseudo: true,
          totalPoints: true,
          currentLevel: true
        }
      });

      if (!user) {
        throw new Error('Utilisateur non trouvé');
      }

      // Compter les utilisateurs avec plus de points
      const rank = await this.prisma.user.count({
        where: {
          totalPoints: {
            gt: user.totalPoints
          }
        }
      }) + 1;

      return {
        rank,
        user
      };

    } catch (error) {
      console.error('Erreur récupération rang utilisateur:', error);
      throw error;
    }
  }

  // ===========================================
  // UTILITAIRES
  // ===========================================

  /**
   * Génère une description par défaut pour une transaction de points
   * @param {string} reason - Raison de la transaction
   * @param {number} points - Nombre de points
   * @returns {string} Description
   */
  getDefaultDescription(reason, points) {
    const descriptions = {
      'BAM_CREATED': `+${points} points pour avoir créé une BAM`,
      'BAM_JOINED': `+${points} points pour avoir rejoint une BAM`,
      'MESSAGE_SENT': `+${points} point pour un message envoyé`,
      'CALL_COMPLETED': `+${points} points pour un appel terminé`,
      'REVIEW_GIVEN': `+${points} points pour avoir donné un avis`,
      'DAILY_LOGIN': `+${points} points de connexion quotidienne`,
      'FIRST_BAM': `+${points} points pour votre première BAM !`,
      'SOCIAL_BUTTERFLY': `+${points} points bonus Social Butterfly !`,
      'BONUS': `+${points} points bonus`,
      'PENALTY': `${points} points de pénalité`
    };

    return descriptions[reason] || `${points} points`;
  }

  /**
   * Initialise les badges par défaut dans la base de données
   * @returns {Array} Badges créés
   */
  async initializeDefaultBadges() {
    try {
      const defaultBadges = [
        {
          name: 'Premier Pas',
          description: 'Créé votre première BAM',
          icon: '🎯',
          category: 'NEWCOMER',
          requirement: 'Créer 1 BAM',
          pointsReward: 10
        },
        {
          name: 'Social Butterfly',
          description: 'Rejoint 10 BAMs différentes',
          icon: '🦋',
          category: 'SOCIAL',
          requirement: 'Rejoindre 10 BAMs',
          pointsReward: 50
        },
        {
          name: 'Grand Communicateur',
          description: 'Envoyé 100 messages',
          icon: '💬',
          category: 'COMMUNICATION',
          requirement: 'Envoyer 100 messages',
          pointsReward: 25
        },
        {
          name: 'Bavard',
          description: 'Effectué 5 appels',
          icon: '📞',
          category: 'COMMUNICATION',
          requirement: 'Effectuer 5 appels',
          pointsReward: 30
        }
      ];

      const createdBadges = [];

      for (const badgeData of defaultBadges) {
        const existing = await this.prisma.badge.findUnique({
          where: { name: badgeData.name }
        });

        if (!existing) {
          const badge = await this.prisma.badge.create({
            data: badgeData
          });
          createdBadges.push(badge);
        }
      }

      console.log(`🏆 ${createdBadges.length} badges par défaut initialisés`);
      return createdBadges;

    } catch (error) {
      console.error('Erreur initialisation badges:', error);
      throw error;
    }
  }

  /**
   * Initialise les achievements par défaut
   * @returns {Array} Achievements créés
   */
  async initializeDefaultAchievements() {
    try {
      const defaultAchievements = [
        {
          name: 'Créateur Novice',
          description: 'Créer 5 BAMs',
          icon: '🌟',
          category: 'CREATION',
          target: 5,
          pointsReward: 25
        },
        {
          name: 'Créateur Expert',
          description: 'Créer 25 BAMs',
          icon: '⭐',
          category: 'CREATION',
          target: 25,
          pointsReward: 100
        },
        {
          name: 'Socialisateur',
          description: 'Rejoindre 20 BAMs',
          icon: '🤝',
          category: 'PARTICIPATION',
          target: 20,
          pointsReward: 50
        },
        {
          name: 'Messager',
          description: 'Envoyer 500 messages',
          icon: '📨',
          category: 'COMMUNICATION',
          target: 500,
          pointsReward: 75
        }
      ];

      const createdAchievements = [];

      for (const achievementData of defaultAchievements) {
        const existing = await this.prisma.achievement.findUnique({
          where: { name: achievementData.name }
        });

        if (!existing) {
          const achievement = await this.prisma.achievement.create({
            data: achievementData
          });
          createdAchievements.push(achievement);
        }
      }

      console.log(`🎯 ${createdAchievements.length} achievements par défaut initialisés`);
      return createdAchievements;

    } catch (error) {
      console.error('Erreur initialisation achievements:', error);
      throw error;
    }
  }

  // =============================================================================
  // SYSTÈME DE BADGES AVANCÉ
  // =============================================================================

  /**
   * Initialiser les badges par défaut avec les nouveaux modèles
   */
  async initializeAdvancedBadges() {
    const advancedBadges = [
      {
        name: 'Premier Pas',
        description: 'Créer votre premier BAM',
        category: 'CREATOR',
        pointsReward: 50,
        rarity: 'COMMON',
        conditions: JSON.stringify({ type: 'first_bam' }),
        iconUrl: 'https://cdn.example.com/badges/first-step.png'
      },
      {
        name: 'Sociable',
        description: 'Répondre à 10 BAMs',
        category: 'SOCIAL',
        pointsReward: 100,
        rarity: 'COMMON',
        conditions: JSON.stringify({ type: 'bam_responses', count: 10 })
      },
      {
        name: 'Explorateur',
        description: 'Créer des BAMs dans 5 villes différentes',
        category: 'EXPLORER',
        pointsReward: 200,
        rarity: 'UNCOMMON',
        conditions: JSON.stringify({ type: 'unique_cities', count: 5 })
      },
      {
        name: 'Bavard',
        description: 'Envoyer 100 messages',
        category: 'SOCIAL',
        pointsReward: 150,
        rarity: 'COMMON',
        conditions: JSON.stringify({ type: 'messages_sent', count: 100 })
      },
      {
        name: 'Connecté',
        description: 'Effectuer 25 appels',
        category: 'SOCIAL',
        pointsReward: 300,
        rarity: 'UNCOMMON',
        conditions: JSON.stringify({ type: 'calls_made', count: 25 })
      },
      {
        name: 'Assidu',
        description: 'Se connecter 30 jours consécutifs',
        category: 'ACHIEVER',
        pointsReward: 500,
        rarity: 'RARE',
        conditions: JSON.stringify({ type: 'daily_streak', count: 30 })
      },
      {
        name: 'Populaire',
        description: 'Recevoir une moyenne de 4.5 étoiles sur 20 notes',
        category: 'SOCIAL',
        pointsReward: 400,
        rarity: 'UNCOMMON',
        conditions: JSON.stringify({ type: 'average_rating', rating: 4.5, count: 20 })
      },
      {
        name: 'Créateur Prolifique',
        description: 'Créer 100 BAMs',
        category: 'CREATOR',
        pointsReward: 800,
        rarity: 'RARE',
        conditions: JSON.stringify({ type: 'bams_created', count: 100 })
      },
      {
        name: 'Maître BAM',
        description: 'Créer 500 BAMs',
        category: 'CREATOR',
        pointsReward: 2000,
        rarity: 'EPIC',
        conditions: JSON.stringify({ type: 'bams_created', count: 500 })
      },
      {
        name: 'Légende',
        description: 'Atteindre le niveau 50',
        category: 'ACHIEVER',
        pointsReward: 5000,
        rarity: 'LEGENDARY',
        conditions: JSON.stringify({ type: 'level', level: 50 })
      }
    ];

    const createdBadges = [];

    for (const badgeData of advancedBadges) {
      const existing = await this.prisma.badge.findUnique({
        where: { name: badgeData.name }
      });

      if (!existing) {
        const badge = await this.prisma.badge.create({
          data: badgeData
        });
        createdBadges.push(badge);
      }
    }

    console.log(`🏆 ${createdBadges.length} badges avancés initialisés`);
    return createdBadges;
  }

  /**
   * Vérifier et attribuer les badges pour un utilisateur
   */
  async checkAdvancedBadges(userId) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        bams: true,
        responses: true,
        sentMessages: true,
        callsMade: true,
        reviewsReceived: true,
        userBadges: {
          include: { badge: true }
        },
        dailyStreak: true
      }
    });

    if (!user) return [];

    const allBadges = await this.prisma.badge.findMany({
      where: { isActive: true }
    });

    const userBadgeIds = user.userBadges.map(ub => ub.badgeId);
    const newBadges = [];

    for (const badge of allBadges) {
      if (userBadgeIds.includes(badge.id)) continue;

      const conditions = JSON.parse(badge.conditions);
      const isEligible = await this.checkBadgeConditions(user, conditions);

      if (isEligible) {
        const userBadge = await this.awardBadge(userId, badge.id);
        newBadges.push(userBadge);
      }
    }

    return newBadges;
  }

  /**
   * Vérifier les conditions d'un badge
   */
  async checkBadgeConditions(user, conditions) {
    switch (conditions.type) {
      case 'first_bam':
        return user.bams.length >= 1;

      case 'bam_responses':
        return user.responses.length >= conditions.count;

      case 'bams_created':
        return user.bams.length >= conditions.count;

      case 'messages_sent':
        return user.sentMessages.length >= conditions.count;

      case 'calls_made':
        return user.callsMade.length >= conditions.count;

      case 'daily_streak':
        return user.dailyStreak?.currentStreak >= conditions.count;

      case 'level':
        return user.currentLevel >= conditions.level;

      case 'average_rating':
        if (user.reviewsReceived.length < conditions.count) return false;
        const avgRating = user.reviewsReceived.reduce((sum, r) => sum + r.rating, 0) / user.reviewsReceived.length;
        return avgRating >= conditions.rating;

      case 'unique_cities':
        // Compter les villes uniques des BAMs (approximation avec lat/lng)
        const cities = new Set();
        user.bams.forEach(bam => {
          const cityKey = `${Math.round(bam.latitude * 10) / 10}_${Math.round(bam.longitude * 10) / 10}`;
          cities.add(cityKey);
        });
        return cities.size >= conditions.count;

      default:
        return false;
    }
  }

  /**
   * Attribuer un badge à un utilisateur
   */
  async awardBadge(userId, badgeId) {
    const badge = await this.prisma.badge.findUnique({
      where: { id: badgeId }
    });

    if (!badge) throw new Error('Badge introuvable');

    // Vérifier que l'utilisateur n'a pas déjà ce badge
    const existingBadge = await this.prisma.userBadge.findUnique({
      where: {
        userId_badgeId: { userId, badgeId }
      }
    });

    if (existingBadge) return existingBadge;

    const userBadge = await this.prisma.userBadge.create({
      data: {
        userId,
        badgeId
      },
      include: {
        badge: true
      }
    });

    // Ajouter les points bonus
    if (badge.pointsReward > 0) {
      await this.addPoints(userId, badge.pointsReward, `Badge: ${badge.name}`);
    }

    // Notification WebSocket
    if (this.webSocketService) {
      this.webSocketService.notifyBadgeEarned(userId, {
        badge: badge,
        pointsEarned: badge.pointsReward
      });
    }

    return userBadge;
  }

  // =============================================================================
  // SYSTÈME DE STREAK QUOTIDIEN
  // =============================================================================

  /**
   * Traiter la connexion quotidienne d'un utilisateur
   */
  async processDailyLogin(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const streak = await this.prisma.dailyStreak.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        currentStreak: 0,
        longestStreak: 0,
        totalDays: 0
      }
    });

    const lastLogin = streak.lastLoginDate ? new Date(streak.lastLoginDate) : null;
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let streakUpdated = false;
    let isFirstToday = false;

    // Vérifier si c'est la première connexion aujourd'hui
    if (!lastLogin || lastLogin < today) {
      isFirstToday = true;
      
      // Calculer le nouveau streak
      let newCurrentStreak = 1;
      if (lastLogin && lastLogin.getTime() === yesterday.getTime()) {
        // Connexion hier, continuer le streak
        newCurrentStreak = streak.currentStreak + 1;
      }

      const newLongestStreak = Math.max(streak.longestStreak, newCurrentStreak);

      await this.prisma.dailyStreak.update({
        where: { userId },
        data: {
          currentStreak: newCurrentStreak,
          longestStreak: newLongestStreak,
          lastLoginDate: today,
          totalDays: streak.totalDays + 1,
          streakStart: newCurrentStreak === 1 ? today : streak.streakStart
        }
      });

      streakUpdated = true;

      // Points pour connexion quotidienne
      const pointsToAdd = newCurrentStreak === 1 ? 25 : 5; // Bonus pour la première connexion après une pause
      await this.addPoints(userId, pointsToAdd, 'Connexion quotidienne');

      // Points bonus pour streaks spéciaux
      if (newCurrentStreak % 7 === 0) {
        await this.addPoints(userId, 50, `Streak hebdomadaire (${newCurrentStreak} jours)`);
      }
      if (newCurrentStreak % 30 === 0) {
        await this.addPoints(userId, 200, `Streak mensuel (${newCurrentStreak} jours)`);
      }

      // Notification WebSocket de streak
      if (this.webSocketService && newCurrentStreak > 1) {
        this.webSocketService.notifyStreakUpdate(userId, {
          currentStreak: newCurrentStreak,
          longestStreak: newLongestStreak,
          bonusEarned: newCurrentStreak % 7 === 0 || newCurrentStreak % 30 === 0
        });
      }
    }

    return {
      isFirstToday,
      streakUpdated,
      currentStreak: streakUpdated ? 
        (await this.prisma.dailyStreak.findUnique({ where: { userId } }))?.currentStreak : 
        streak.currentStreak
    };
  }

  // =============================================================================
  // CLASSEMENTS AVANCÉS
  // =============================================================================

  /**
   * Obtenir le classement général par points
   */
  async getPointsLeaderboard(limit = 10, period = 'ALL_TIME') {
    let whereClause = {};

    if (period !== 'ALL_TIME') {
      const now = new Date();
      let startDate;

      switch (period) {
        case 'DAILY':
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'WEEKLY':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          break;
        case 'MONTHLY':
          startDate = new Date(now);
          startDate.setMonth(now.getMonth() - 1);
          break;
      }

      if (startDate) {
        // Pour les périodes autres que ALL_TIME, on base sur les points gagnés dans la période
        const users = await this.prisma.user.findMany({
          select: {
            id: true,
            pseudo: true,
            profileImageUrl: true,
            currentLevel: true,
            pointHistory: {
              where: {
                createdAt: { gte: startDate },
                type: 'EARNED'
              },
              select: { amount: true }
            }
          }
        });

        const leaderboard = users
          .map(user => ({
            ...user,
            periodPoints: user.pointHistory.reduce((sum, p) => sum + p.amount, 0)
          }))
          .filter(user => user.periodPoints > 0)
          .sort((a, b) => b.periodPoints - a.periodPoints)
          .slice(0, limit)
          .map((user, index) => ({
            position: index + 1,
            user: {
              id: user.id,
              pseudo: user.pseudo,
              profileImageUrl: user.profileImageUrl,
              currentLevel: user.currentLevel
            },
            score: user.periodPoints
          }));

        return { leaderboard, period };
      }
    }

    // Classement ALL_TIME par points totaux
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        pseudo: true,
        profileImageUrl: true,
        totalPoints: true,
        currentLevel: true
      },
      orderBy: { totalPoints: 'desc' },
      take: limit
    });

    const leaderboard = users.map((user, index) => ({
      position: index + 1,
      user: {
        id: user.id,
        pseudo: user.pseudo,
        profileImageUrl: user.profileImageUrl,
        currentLevel: user.currentLevel
      },
      score: user.totalPoints
    }));

    return { leaderboard, period };
  }

  /**
   * Obtenir la position d'un utilisateur dans le classement
   */
  async getUserLeaderboardPosition(userId) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totalPoints: true }
    });

    if (!user) return null;

    const betterUsers = await this.prisma.user.count({
      where: {
        totalPoints: { gt: user.totalPoints }
      }
    });

    return {
      position: betterUsers + 1,
      totalPoints: user.totalPoints
    };
  }

  // =============================================================================
  // STATISTIQUES GAMIFICATION COMPLÈTES
  // =============================================================================

  /**
   * Statistiques complètes d'un utilisateur
   */
  async getUserGamificationStats(userId) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userBadges: {
          include: { badge: true },
          orderBy: { earnedAt: 'desc' }
        },
        userAchievements: {
          include: { achievement: true },
          orderBy: { earnedAt: 'desc' }
        },
        dailyStreak: true,
        pointHistory: {
          where: { type: 'EARNED' },
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!user) throw new Error('Utilisateur introuvable');

    const leaderboardPosition = await this.getUserLeaderboardPosition(userId);
    
    // Calcul amélioré du niveau suivant
    const currentLevelThreshold = this.LEVEL_THRESHOLDS.find(l => l.level === user.currentLevel) || this.LEVEL_THRESHOLDS[0];
    const nextLevelThreshold = this.LEVEL_THRESHOLDS.find(l => l.level === user.currentLevel + 1);
    
    let progressToNextLevel = 100; // Si pas de niveau suivant, on est au max
    let pointsForNext = 0;
    
    if (nextLevelThreshold) {
      pointsForNext = nextLevelThreshold.minPoints;
      const pointsInCurrentLevel = user.totalPoints - currentLevelThreshold.minPoints;
      const pointsNeededForNext = nextLevelThreshold.minPoints - currentLevelThreshold.minPoints;
      progressToNextLevel = Math.round((pointsInCurrentLevel / pointsNeededForNext) * 100);
    }

    return {
      level: {
        current: user.currentLevel,
        totalPoints: user.totalPoints,
        pointsForNext: pointsForNext,
        progressPercent: Math.min(progressToNextLevel, 100)
      },
      badges: {
        total: user.userBadges.length,
        recent: user.userBadges
          .slice(0, 5)
          .map(ub => ub.badge),
        byRarity: this.groupBadgesByRarity(user.userBadges.map(ub => ub.badge))
      },
      achievements: {
        total: user.userAchievements.length,
        recent: user.userAchievements
          .slice(0, 5)
          .map(ua => ua.achievement)
      },
      streak: user.dailyStreak || {
        currentStreak: 0,
        longestStreak: 0,
        totalDays: 0
      },
      leaderboard: leaderboardPosition,
      recentPoints: user.pointHistory
    };
  }

  /**
   * Grouper les badges par rareté
   */
  groupBadgesByRarity(badges) {
    const grouped = {
      COMMON: 0,
      UNCOMMON: 0,
      RARE: 0,
      EPIC: 0,
      LEGENDARY: 0
    };

    badges.forEach(badge => {
      if (grouped.hasOwnProperty(badge.rarity)) {
        grouped[badge.rarity]++;
      }
    });

    return grouped;
  }

  // =============================================================================
  // MÉTHODES WEBHOOK POUR INTÉGRATION AUTOMATIQUE
  // =============================================================================

  /**
   * Traiter automatiquement les points lors d'actions utilisateur
   */
  async handleUserAction(userId, action, data = {}) {
    try {
      let pointsAwarded = 0;
      let reason = '';

      switch (action) {
        case 'BAM_CREATED':
          pointsAwarded = this.POINT_VALUES.BAM_CREATED;
          reason = 'Création d\'un BAM';
          break;
        case 'BAM_JOINED':
          pointsAwarded = this.POINT_VALUES.BAM_JOINED;
          reason = 'Participation à un BAM';
          break;
        case 'MESSAGE_SENT':
          pointsAwarded = this.POINT_VALUES.MESSAGE_SENT;
          reason = 'Message envoyé';
          break;
        case 'CALL_COMPLETED':
          pointsAwarded = this.POINT_VALUES.CALL_COMPLETED;
          reason = 'Appel terminé';
          break;
        case 'REVIEW_GIVEN':
          pointsAwarded = this.POINT_VALUES.REVIEW_GIVEN;
          reason = 'Avis donné';
          break;
        case 'DAILY_LOGIN':
          const loginResult = await this.processDailyLogin(userId);
          // Les points sont déjà attribués dans processDailyLogin
          break;
        default:
          console.warn(`Action inconnue: ${action}`);
          return { action, pointsAwarded: 0, reason: 'Action inconnue' };
      }

      if (pointsAwarded > 0) {
        await this.addPoints(userId, pointsAwarded, reason);
      }

      // Vérifier les badges et achievements après chaque action
      await this.checkAdvancedBadges(userId);
      await this.checkUserAchievements(userId);

      return { action, pointsAwarded, reason };
    } catch (error) {
      console.error('Erreur handleUserAction:', error);
      throw error;
    }
  }

  // =============================================================================
  // MÉTHODES UTILITAIRES POUR LES ROUTES
  // =============================================================================

  /**
   * Obtenir tous les badges avec filtres optionnels
   */
  async getAllBadges(filters = {}) {
    const whereClause = { isActive: true };
    
    if (filters.category) {
      whereClause.category = filters.category;
    }
    if (filters.rarity) {
      whereClause.rarity = filters.rarity;
    }

    return await this.prisma.badge.findMany({
      where: whereClause,
      orderBy: [
        { rarity: 'asc' },
        { name: 'asc' }
      ]
    });
  }

  /**
   * Obtenir les badges d'un utilisateur
   */
  async getUserBadges(userId) {
    return await this.prisma.userBadge.findMany({
      where: { userId },
      include: {
        badge: true
      },
      orderBy: { earnedAt: 'desc' }
    });
  }

  /**
   * Obtenir les informations de streak d'un utilisateur
   */
  async getUserStreak(userId) {
    const streak = await this.prisma.dailyStreak.findUnique({
      where: { userId }
    });

    return streak || {
      currentStreak: 0,
      longestStreak: 0,
      lastLoginDate: null,
      totalDays: 0
    };
  }

  /**
   * Obtenir les informations de points d'un utilisateur
   */
  async getUserPointsInfo(userId) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        totalPoints: true,
        currentLevel: true,
        pointHistory: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!user) throw new Error('Utilisateur introuvable');

    return {
      totalPoints: user.totalPoints,
      currentLevel: user.currentLevel,
      recentHistory: user.pointHistory
    };
  }

  /**
   * Obtenir les informations de niveau d'un utilisateur
   */
  async getUserLevel(userId) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        totalPoints: true,
        currentLevel: true
      }
    });

    if (!user) throw new Error('Utilisateur introuvable');

    const currentLevelData = this.LEVEL_THRESHOLDS.find(l => l.level === user.currentLevel);
    const nextLevelData = this.LEVEL_THRESHOLDS.find(l => l.level === user.currentLevel + 1);

    let progressToNext = 100;
    let pointsForNext = null;

    if (nextLevelData) {
      const pointsInLevel = user.totalPoints - currentLevelData.minPoints;
      const pointsNeededForNext = nextLevelData.minPoints - currentLevelData.minPoints;
      progressToNext = Math.min(Math.round((pointsInLevel / pointsNeededForNext) * 100), 100);
      pointsForNext = nextLevelData.minPoints;
    }

    return {
      currentLevel: user.currentLevel,
      totalPoints: user.totalPoints,
      progressPercent: progressToNext,
      pointsForNext,
      currentLevelThreshold: currentLevelData?.minPoints || 0,
      nextLevelThreshold: nextLevelData?.minPoints || null
    };
  }
}

// Export du singleton
const gamificationService = GamificationService; // Singleton instance
module.exports = gamificationService;