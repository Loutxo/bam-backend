const { PrismaClient } = require('@prisma/client');

class ReportingService {
  constructor() {
    if (ReportingService.instance) {
      return ReportingService.instance;
    }

    this.prisma = new PrismaClient();
    // Injection de dépendance pour le WebSocketService (évite les dépendances circulaires)
    this.webSocketService = null;
    ReportingService.instance = this;
  }

  /**
   * Injecte le service WebSocket pour les notifications temps réel
   */
  setWebSocketService(webSocketService) {
    this.webSocketService = webSocketService;
  }

  // =============================================================================
  // CRÉATION DE SIGNALEMENTS
  // =============================================================================

  /**
   * Créer un signalement d'utilisateur
   */
  async reportUser(reporterId, targetUserId, category, reason, description = null, evidence = null) {
    // Validation de base
    if (reporterId === targetUserId) {
      throw new Error('Impossible de se signaler soi-même');
    }

    // Vérifier que l'utilisateur cible existe
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId }
    });

    if (!targetUser) {
      throw new Error('Utilisateur à signaler introuvable');
    }

    // Vérifier si un signalement similaire existe déjà (dans les dernières 24h)
    const existingReport = await this.prisma.report.findFirst({
      where: {
        reporterId,
        targetUserId,
        category,
        status: { in: ['PENDING', 'REVIEWING'] },
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24h
        }
      }
    });

    if (existingReport) {
      throw new Error('Vous avez déjà signalé cet utilisateur récemment pour cette raison');
    }

    const report = await this.prisma.report.create({
      data: {
        type: 'USER',
        category,
        reporterId,
        targetUserId,
        reason,
        description,
        evidence,
        status: 'PENDING'
      },
      include: {
        reporter: { select: { id: true, pseudo: true } },
        targetUser: { select: { id: true, pseudo: true } }
      }
    });

    // Vérifier si auto-modération nécessaire
    await this.checkAutoModeration(report);

    // Notifications WebSocket
    if (this.webSocketService) {
      // Notifier l'utilisateur signalé
      this.webSocketService.notifyUserReported(targetUserId, {
        id: report.id,
        category: report.category,
        reporter: report.reporter.pseudo
      });

      // Notifier les modérateurs
      this.webSocketService.notifyModerators({
        id: report.id,
        type: report.type,
        category: report.category,
        targetUser: report.targetUser.pseudo,
        reporter: report.reporter.pseudo
      });
    }

    return report;
  }

  /**
   * Créer un signalement de BAM
   */
  async reportBam(reporterId, targetBamId, category, reason, description = null, evidence = null) {
    // Vérifier que le BAM existe
    const targetBam = await this.prisma.bam.findUnique({
      where: { id: targetBamId },
      include: { user: true }
    });

    if (!targetBam) {
      throw new Error('BAM à signaler introuvable');
    }

    // Vérifier qu'on ne signale pas son propre BAM
    if (reporterId === targetBam.userId) {
      throw new Error('Impossible de signaler son propre BAM');
    }

    // Vérifier signalement récent
    const existingReport = await this.prisma.report.findFirst({
      where: {
        reporterId,
        targetBamId,
        category,
        status: { in: ['PENDING', 'REVIEWING'] },
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    });

    if (existingReport) {
      throw new Error('Vous avez déjà signalé ce BAM récemment pour cette raison');
    }

    const report = await this.prisma.report.create({
      data: {
        type: 'BAM',
        category,
        reporterId,
        targetBamId,
        reason,
        description,
        evidence,
        status: 'PENDING'
      },
      include: {
        reporter: { select: { id: true, pseudo: true } },
        targetBam: { 
          select: { 
            id: true, 
            text: true, 
            user: { select: { id: true, pseudo: true } }
          } 
        }
      }
    });

    await this.checkAutoModeration(report);

    // Notifications WebSocket
    if (this.webSocketService) {
      // Notifier le propriétaire du BAM
      this.webSocketService.notifyUserReported(report.targetBam.user.id, {
        id: report.id,
        category: report.category,
        type: 'BAM',
        bamText: report.targetBam.text.substring(0, 50) + '...'
      });

      // Notifier les modérateurs
      this.webSocketService.notifyModerators({
        id: report.id,
        type: report.type,
        category: report.category,
        targetBam: report.targetBam.text.substring(0, 100),
        bamOwner: report.targetBam.user.pseudo,
        reporter: report.reporter.pseudo
      });
    }

    return report;
  }

  /**
   * Créer un signalement de message
   */
  async reportMessage(reporterId, targetMessageId, category, reason, description = null, evidence = null) {
    // Vérifier que le message existe
    const targetMessage = await this.prisma.message.findUnique({
      where: { id: targetMessageId },
      include: { fromUser: true, toUser: true }
    });

    if (!targetMessage) {
      throw new Error('Message à signaler introuvable');
    }

    // Vérifier que le rapporteur est impliqué dans la conversation
    if (reporterId !== targetMessage.fromUserId && reporterId !== targetMessage.toUserId) {
      throw new Error('Vous ne pouvez signaler que les messages de vos conversations');
    }

    // Vérifier qu'on ne signale pas son propre message
    if (reporterId === targetMessage.fromUserId) {
      throw new Error('Impossible de signaler son propre message');
    }

    const report = await this.prisma.report.create({
      data: {
        type: 'MESSAGE',
        category,
        reporterId,
        targetMessageId,
        reason,
        description,
        evidence,
        status: 'PENDING'
      },
      include: {
        reporter: { select: { id: true, pseudo: true } },
        targetMessage: { 
          select: { 
            id: true, 
            text: true, 
            fromUser: { select: { id: true, pseudo: true } }
          } 
        }
      }
    });

    await this.checkAutoModeration(report);

    // Notifications WebSocket
    if (this.webSocketService) {
      // Notifier l'auteur du message
      this.webSocketService.notifyUserReported(report.targetMessage.fromUser.id, {
        id: report.id,
        category: report.category,
        type: 'MESSAGE',
        messageText: report.targetMessage.text.substring(0, 50) + '...'
      });

      // Notifier les modérateurs
      this.webSocketService.notifyModerators({
        id: report.id,
        type: report.type,
        category: report.category,
        targetMessage: report.targetMessage.text.substring(0, 100),
        messageAuthor: report.targetMessage.fromUser.pseudo,
        reporter: report.reporter.pseudo
      });
    }

    return report;
  }

  // =============================================================================
  // CONSULTATION SIGNALEMENTS
  // =============================================================================

  /**
   * Récupérer les signalements créés par un utilisateur
   */
  async getUserReports(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where: { reporterId: userId },
        include: {
          targetUser: { select: { id: true, pseudo: true } },
          targetBam: { 
            select: { 
              id: true, 
              text: true, 
              user: { select: { pseudo: true } }
            } 
          },
          targetMessage: { 
            select: { 
              id: true, 
              text: true, 
              fromUser: { select: { pseudo: true } }
            } 
          },
          reviewedByUser: { select: { id: true, pseudo: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      this.prisma.report.count({
        where: { reporterId: userId }
      })
    ]);

    return {
      reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Récupérer les signalements pour modération (admin)
   */
  async getReportsForModeration(filters = {}, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    
    const where = {};
    
    if (filters.status) {
      where.status = filters.status;
    }
    
    if (filters.category) {
      where.category = filters.category;
    }
    
    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.dateFrom) {
      where.createdAt = { gte: new Date(filters.dateFrom) };
    }

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        include: {
          reporter: { select: { id: true, pseudo: true } },
          targetUser: { select: { id: true, pseudo: true } },
          targetBam: { 
            select: { 
              id: true, 
              text: true, 
              user: { select: { id: true, pseudo: true } }
            } 
          },
          targetMessage: { 
            select: { 
              id: true, 
              text: true, 
              fromUser: { select: { id: true, pseudo: true } }
            } 
          },
          reviewedByUser: { select: { id: true, pseudo: true } }
        },
        orderBy: [
          { status: 'asc' }, // PENDING en premier
          { createdAt: 'desc' }
        ],
        skip,
        take: limit
      }),
      this.prisma.report.count({ where })
    ]);

    return {
      reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // =============================================================================
  // TRAITEMENT SIGNALEMENTS (MODÉRATION)
  // =============================================================================

  /**
   * Traiter un signalement
   */
  async processReport(reportId, moderatorId, status, actionTaken = null, adminNotes = null) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: {
        targetUser: true,
        targetBam: true,
        targetMessage: true
      }
    });

    if (!report) {
      throw new Error('Signalement introuvable');
    }

    if (report.status === 'RESOLVED' || report.status === 'DISMISSED') {
      throw new Error('Ce signalement a déjà été traité');
    }

    const updatedReport = await this.prisma.report.update({
      where: { id: reportId },
      data: {
        status,
        reviewedBy: moderatorId,
        reviewedAt: new Date(),
        actionTaken,
        adminNotes
      },
      include: {
        reporter: { select: { id: true, pseudo: true } },
        targetUser: { select: { id: true, pseudo: true } },
        reviewedByUser: { select: { id: true, pseudo: true } }
      }
    });

    // Si le signalement est résolu avec action, appliquer automatiquement
    if (status === 'RESOLVED' && actionTaken) {
      await this.applyModerationAction(report, actionTaken, moderatorId);
    }

    // Notification WebSocket du changement de statut
    if (this.webSocketService) {
      this.webSocketService.notifyReportStatusUpdate(updatedReport.reporter.id, {
        id: updatedReport.id,
        status: updatedReport.status,
        actionTaken: updatedReport.actionTaken,
        reviewedBy: updatedReport.reviewedByUser?.pseudo
      });
    }

    return updatedReport;
  }

  /**
   * Appliquer une action de modération
   */
  async applyModerationAction(report, actionType, moderatorId) {
    if (!report.targetUserId) return; // Pas d'action sur utilisateur si pas de cible

    const actions = {
      'WARNING': () => this.issueWarning(report.targetUserId, report.reason, moderatorId),
      'TEMP_BAN_1H': () => this.issueTempBan(report.targetUserId, 1, report.reason, moderatorId),
      'TEMP_BAN_24H': () => this.issueTempBan(report.targetUserId, 24, report.reason, moderatorId),
      'TEMP_BAN_7D': () => this.issueTempBan(report.targetUserId, 24 * 7, report.reason, moderatorId),
      'PERMANENT_BAN': () => this.issuePermanentBan(report.targetUserId, report.reason, moderatorId),
      'CHAT_RESTRICT': () => this.issueChatRestriction(report.targetUserId, 24, report.reason, moderatorId),
      'DELETE_CONTENT': () => this.deleteReportedContent(report)
    };

    const action = actions[actionType];
    if (action) {
      await action();
    }
  }

  // =============================================================================
  // SANCTIONS
  // =============================================================================

  /**
   * Émettre un avertissement
   */
  async issueWarning(userId, reason, moderatorId) {
    const sanction = await this.prisma.userSanction.create({
      data: {
        userId,
        type: 'WARNING',
        reason,
        issuedBy: moderatorId
      },
      include: {
        user: { select: { pseudo: true } }
      }
    });

    // Notification WebSocket
    if (this.webSocketService) {
      this.webSocketService.notifyUserSanctioned(userId, {
        type: 'WARNING',
        reason,
        message: `Vous avez reçu un avertissement: ${reason}`
      });
    }

    return sanction;
  }

  /**
   * Émettre un ban temporaire
   */
  async issueTempBan(userId, durationHours, reason, moderatorId) {
    const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);
    
    const sanction = await this.prisma.userSanction.create({
      data: {
        userId,
        type: 'TEMPORARY_BAN',
        reason,
        duration: durationHours,
        expiresAt,
        issuedBy: moderatorId
      },
      include: {
        user: { select: { pseudo: true } }
      }
    });

    // Notification WebSocket
    if (this.webSocketService) {
      this.webSocketService.notifyUserSanctioned(userId, {
        type: 'TEMPORARY_BAN',
        reason,
        duration: durationHours,
        expiresAt: expiresAt.toISOString(),
        message: `Vous avez été suspendu pour ${durationHours}h: ${reason}`
      });
    }

    return sanction;
  }

  /**
   * Émettre un ban permanent
   */
  async issuePermanentBan(userId, reason, moderatorId) {
    const sanction = await this.prisma.userSanction.create({
      data: {
        userId,
        type: 'PERMANENT_BAN',
        reason,
        issuedBy: moderatorId
      },
      include: {
        user: { select: { pseudo: true } }
      }
    });

    // Notification WebSocket et déconnexion forcée
    if (this.webSocketService) {
      this.webSocketService.notifyUserSanctioned(userId, {
        type: 'PERMANENT_BAN',
        reason,
        message: `Vous avez été banni définitivement: ${reason}`
      });
    }

    return sanction;
  }

  /**
   * Restriction de chat
   */
  async issueChatRestriction(userId, durationHours, reason, moderatorId) {
    const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000);
    
    return await this.prisma.userSanction.create({
      data: {
        userId,
        type: 'CHAT_RESTRICT',
        reason,
        duration: durationHours,
        expiresAt,
        issuedBy: moderatorId
      }
    });
  }

  /**
   * Supprimer le contenu signalé
   */
  async deleteReportedContent(report) {
    try {
      if (report.targetBamId) {
        await this.prisma.bam.delete({
          where: { id: report.targetBamId }
        });
      } else if (report.targetMessageId) {
        await this.prisma.message.delete({
          where: { id: report.targetMessageId }
        });
      }
    } catch (error) {
      console.error('Erreur suppression contenu:', error);
      // Ne pas faire échouer toute l'opération si la suppression échoue
    }
  }

  /**
   * Vérifier les sanctions actives d'un utilisateur
   */
  async getUserActiveSanctions(userId) {
    return await this.prisma.userSanction.findMany({
      where: {
        userId,
        isActive: true,
        OR: [
          { expiresAt: null }, // Sanctions permanentes
          { expiresAt: { gt: new Date() } } // Sanctions temporaires non expirées
        ]
      },
      include: {
        issuedByUser: { select: { id: true, pseudo: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Vérifier si un utilisateur est banni
   */
  async isUserBanned(userId) {
    const activeBans = await this.prisma.userSanction.findFirst({
      where: {
        userId,
        type: { in: ['TEMPORARY_BAN', 'PERMANENT_BAN'] },
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      }
    });

    return activeBans !== null;
  }

  // =============================================================================
  // AUTO-MODÉRATION
  // =============================================================================

  /**
   * Vérifier si un signalement nécessite une action automatique
   */
  async checkAutoModeration(report) {
    // Compter les signalements récents de la même cible
    const recentReports = await this.prisma.report.count({
      where: {
        targetUserId: report.targetUserId,
        status: { in: ['PENDING', 'REVIEWING'] },
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24h
        }
      }
    });

    // Auto-action si beaucoup de signalements
    if (recentReports >= 5) {
      // Auto-ban temporaire si trop de signalements
      await this.autoAction(report, 'AUTO_TEMP_BAN', 'Trop de signalements récents');
    } else if (recentReports >= 3) {
      // Escalader pour révision manuelle
      await this.prisma.report.update({
        where: { id: report.id },
        data: { status: 'ESCALATED' }
      });
    }

    // Vérifier les règles d'auto-modération sur le contenu
    await this.checkContentAutoModeration(report);
  }

  /**
   * Vérifier le contenu avec les règles d'auto-modération
   */
  async checkContentAutoModeration(report) {
    let content = '';
    
    if (report.targetBamId) {
      const bam = await this.prisma.bam.findUnique({
        where: { id: report.targetBamId }
      });
      content = bam?.text || '';
    } else if (report.targetMessageId) {
      const message = await this.prisma.message.findUnique({
        where: { id: report.targetMessageId }
      });
      content = message?.text || '';
    }

    if (!content) return;

    // Récupérer les règles actives
    const rules = await this.prisma.autoModerationRule.findMany({
      where: { isActive: true },
      orderBy: { severity: 'desc' }
    });

    for (const rule of rules) {
      if (this.matchesRule(content, rule.pattern)) {
        await this.prisma.autoModerationRule.update({
          where: { id: rule.id },
          data: { triggeredCount: { increment: 1 } }
        });

        await this.applyAutoAction(report, rule.action, `Auto-modération: ${rule.name}`);
        break; // Appliquer seulement la première règle qui match
      }
    }
  }

  /**
   * Vérifier si le contenu correspond à une règle
   */
  matchesRule(content, pattern) {
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
   * Appliquer une action automatique
   */
  async applyAutoAction(report, action, reason) {
    const actions = {
      'FLAG': () => this.prisma.report.update({
        where: { id: report.id },
        data: { status: 'REVIEWING' }
      }),
      'HIDE': () => this.hideContent(report),
      'DELETE': () => this.deleteReportedContent(report),
      'WARN_USER': () => this.issueWarning(report.targetUserId, reason, 'SYSTEM'),
      'TEMP_BAN': () => this.issueTempBan(report.targetUserId, 1, reason, 'SYSTEM')
    };

    const actionFn = actions[action];
    if (actionFn) {
      await actionFn();
    }
  }

  /**
   * Action automatique pour trop de signalements
   */
  async autoAction(report, actionType, reason) {
    if (actionType === 'AUTO_TEMP_BAN' && report.targetUserId) {
      await this.issueTempBan(report.targetUserId, 1, reason, 'SYSTEM');
      
      await this.prisma.report.update({
        where: { id: report.id },
        data: { 
          status: 'RESOLVED',
          actionTaken: 'AUTO_TEMP_BAN_1H',
          adminNotes: reason
        }
      });
    }
  }

  /**
   * Masquer du contenu (soft delete)
   */
  async hideContent(report) {
    // Cette fonction pourrait ajouter un flag "hidden" au lieu de supprimer
    // Pour l'instant, on utilise la suppression
    await this.deleteReportedContent(report);
  }

  // =============================================================================
  // STATISTIQUES
  // =============================================================================

  /**
   * Statistiques de modération
   */
  async getModerationStats() {
    const [
      totalReports,
      pendingReports,
      resolvedReports,
      dismissedReports,
      activeSanctions,
      totalSanctions
    ] = await Promise.all([
      this.prisma.report.count(),
      this.prisma.report.count({ where: { status: 'PENDING' } }),
      this.prisma.report.count({ where: { status: 'RESOLVED' } }),
      this.prisma.report.count({ where: { status: 'DISMISSED' } }),
      this.prisma.userSanction.count({ 
        where: { 
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        } 
      }),
      this.prisma.userSanction.count()
    ]);

    return {
      reports: {
        total: totalReports,
        pending: pendingReports,
        resolved: resolvedReports,
        dismissed: dismissedReports,
        resolutionRate: totalReports > 0 ? ((resolvedReports + dismissedReports) / totalReports * 100).toFixed(1) : 0
      },
      sanctions: {
        active: activeSanctions,
        total: totalSanctions
      }
    };
  }
}

module.exports = ReportingService;