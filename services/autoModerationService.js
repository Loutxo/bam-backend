const { PrismaClient } = require('@prisma/client');

class AutoModerationService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Initialiser les règles par défaut d'auto-modération
   */
  async initializeDefaultRules() {
    const defaultRules = [
      // Règles contre les discours haineux
      {
        name: 'Mots haineux',
        description: 'Détection de mots à caractère haineux ou discriminatoire',
        pattern: 'sale,connard,pute,salope,batard,enculé,fdp,nazi,hitler,genocide,tuez,mort,suicide',
        action: 'HIDE',
        severity: 9,
        isActive: true
      },
      {
        name: 'Menaces de violence',
        description: 'Détection de menaces explicites de violence',
        pattern: '(je vais te|je vais vous|on va te|on va vous).*(tuer|buter|crever|exploser|tabasser)',
        action: 'DELETE',
        severity: 10,
        isActive: true
      },

      // Règles contre le spam
      {
        name: 'Spam répétitif',
        description: 'Messages avec trop de répétitions',
        pattern: '(.)\\1{10,}', // Plus de 10 caractères identiques consécutifs
        action: 'FLAG',
        severity: 3,
        isActive: true
      },
      {
        name: 'URLs suspectes',
        description: 'Détection d\'URLs potentiellement malveillantes',
        pattern: '(bit\\.ly|tinyurl|t\\.co|goo\\.gl|ow\\.ly|short|url|link).*/?',
        action: 'FLAG',
        severity: 4,
        isActive: true
      },

      // Règles contre les arnaques
      {
        name: 'Arnaques financières',
        description: 'Détection de tentatives d\'arnaque financière',
        pattern: '(gagnez|gagner|euros?|€|argent|gratuit|cadeau|promo|reduction|bitcoin|crypto|investir|placement).*(rapide|facile|garantie?|assure?)',
        action: 'HIDE',
        severity: 8,
        isActive: true
      },
      {
        name: 'Demandes d\'informations personnelles',
        description: 'Tentatives de récupération d\'informations personnelles',
        pattern: '(donnez|donner|envoie|envoyez).*(mot de passe|password|carte|bancaire|rib|iban|numero|tel|telephone|adresse)',
        action: 'DELETE',
        severity: 9,
        isActive: true
      },

      // Règles contre le contenu adulte
      {
        name: 'Contenu sexuel explicite',
        description: 'Détection de contenu à caractère sexuel',
        pattern: 'sexe,porn,xxx,nue,nu,cul,seins,penis,vagina,masturbation,orgasme',
        action: 'HIDE',
        severity: 7,
        isActive: true
      },

      // Règles contre le harcèlement
      {
        name: 'Harcèlement répété',
        description: 'Détection de messages de harcèlement',
        pattern: '(arrete|arreter|lache|lacher|fiche|foutre).*(paix|tranquille)',
        action: 'FLAG',
        severity: 6,
        isActive: true
      },

      // Règles générales
      {
        name: 'Majuscules excessives',
        description: 'Messages entièrement en majuscules (spam/cris)',
        pattern: '^[A-Z\\s\\d!@#$%^&*(),.?":{}|<>]{20,}$',
        action: 'FLAG',
        severity: 2,
        isActive: true
      },
      {
        name: 'Caractères spéciaux excessifs',
        description: 'Usage excessif de caractères spéciaux',
        pattern: '[!@#$%^&*()]{5,}',
        action: 'FLAG',
        severity: 3,
        isActive: true
      }
    ];

    const createdRules = [];
    
    for (const ruleData of defaultRules) {
      try {
        // Vérifier si la règle existe déjà
        const existingRule = await this.prisma.autoModerationRule.findUnique({
          where: { name: ruleData.name }
        });

        if (!existingRule) {
          const rule = await this.prisma.autoModerationRule.create({
            data: ruleData
          });
          createdRules.push(rule);
          console.log(`✅ Règle créée: ${rule.name}`);
        } else {
          console.log(`⚠️  Règle existante: ${ruleData.name}`);
        }
      } catch (error) {
        console.error(`❌ Erreur création règle ${ruleData.name}:`, error.message);
      }
    }

    return createdRules;
  }

  /**
   * Mettre à jour une règle d'auto-modération
   */
  async updateRule(ruleId, updates) {
    return await this.prisma.autoModerationRule.update({
      where: { id: ruleId },
      data: updates
    });
  }

  /**
   * Activer/désactiver une règle
   */
  async toggleRule(ruleId, isActive) {
    return await this.prisma.autoModerationRule.update({
      where: { id: ruleId },
      data: { isActive }
    });
  }

  /**
   * Récupérer toutes les règles d'auto-modération
   */
  async getAllRules() {
    return await this.prisma.autoModerationRule.findMany({
      orderBy: [
        { isActive: 'desc' },
        { severity: 'desc' },
        { name: 'asc' }
      ]
    });
  }

  /**
   * Récupérer les statistiques des règles
   */
  async getRulesStats() {
    const [total, active, inactive, totalTriggers] = await Promise.all([
      this.prisma.autoModerationRule.count(),
      this.prisma.autoModerationRule.count({ where: { isActive: true } }),
      this.prisma.autoModerationRule.count({ where: { isActive: false } }),
      this.prisma.autoModerationRule.aggregate({
        _sum: { triggeredCount: true }
      })
    ]);

    const topTriggeredRules = await this.prisma.autoModerationRule.findMany({
      where: { triggeredCount: { gt: 0 } },
      orderBy: { triggeredCount: 'desc' },
      take: 5,
      select: {
        name: true,
        triggeredCount: true,
        severity: true,
        action: true
      }
    });

    return {
      summary: {
        total,
        active,
        inactive,
        totalTriggers: totalTriggers._sum.triggeredCount || 0
      },
      topTriggered: topTriggeredRules
    };
  }

  /**
   * Créer une nouvelle règle personnalisée
   */
  async createCustomRule(ruleData) {
    return await this.prisma.autoModerationRule.create({
      data: {
        name: ruleData.name,
        description: ruleData.description,
        pattern: ruleData.pattern,
        action: ruleData.action,
        severity: ruleData.severity || 5,
        isActive: ruleData.isActive !== false
      }
    });
  }

  /**
   * Supprimer une règle
   */
  async deleteRule(ruleId) {
    return await this.prisma.autoModerationRule.delete({
      where: { id: ruleId }
    });
  }

  /**
   * Tester une règle sur du contenu
   */
  testRule(content, pattern) {
    try {
      // Essayer comme regex d'abord
      const regex = new RegExp(pattern, 'i');
      return regex.test(content);
    } catch (error) {
      // Si ce n'est pas une regex valide, chercher comme mots-clés
      const keywords = pattern.toLowerCase().split(',').map(k => k.trim());
      const lowerContent = content.toLowerCase();
      return keywords.some(keyword => lowerContent.includes(keyword));
    }
  }

  /**
   * Simuler l'auto-modération sur du contenu
   */
  async simulateModeration(content) {
    const activeRules = await this.prisma.autoModerationRule.findMany({
      where: { isActive: true },
      orderBy: { severity: 'desc' }
    });

    const matchedRules = [];
    
    for (const rule of activeRules) {
      if (this.testRule(content, rule.pattern)) {
        matchedRules.push({
          id: rule.id,
          name: rule.name,
          action: rule.action,
          severity: rule.severity,
          description: rule.description
        });
      }
    }

    // Retourner la règle avec la plus haute sévérité qui match
    const highestSeverityRule = matchedRules.length > 0 ? matchedRules[0] : null;

    return {
      wouldTrigger: matchedRules.length > 0,
      matchedRules,
      recommendedAction: highestSeverityRule?.action || 'NONE',
      severity: highestSeverityRule?.severity || 0
    };
  }
}

module.exports = AutoModerationService;