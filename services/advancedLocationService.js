/**
 * Service de géolocalisation avancée
 * Géofencing, historique, zones favorites, notifications de proximité
 */

const { PrismaClient } = require('@prisma/client');

class AdvancedLocationService {
  constructor() {
    if (AdvancedLocationService.instance) {
      return AdvancedLocationService.instance;
    }

    this.prisma = new PrismaClient();
    this.webSocketService = null;

    // Configuration par défaut
    this.config = {
      DEFAULT_GEOFENCE_RADIUS: 500, // 500 mètres
      MAX_HISTORY_DAYS: 90, // Garder 90 jours d'historique
      PROXIMITY_THRESHOLD: 1000, // Notifier si à moins de 1km
      MIN_ACCURACY: 100, // Précision minimale acceptée (mètres)
      BATCH_SIZE: 100 // Traitement par lots
    };

    AdvancedLocationService.instance = this;
  }

  /**
   * Injecter le service WebSocket
   */
  setWebSocketService(webSocketService) {
    this.webSocketService = webSocketService;
  }

  // =============================================================================
  // HISTORIQUE DES POSITIONS
  // =============================================================================

  /**
   * Enregistrer une nouvelle position
   */
  async recordLocation(userId, locationData) {
    const { latitude, longitude, accuracy, address, city, country, source = 'MANUAL' } = locationData;

    // Valider la précision
    if (accuracy && accuracy > this.config.MIN_ACCURACY) {
      console.warn(`Position ignorée pour ${userId}: précision insuffisante (${accuracy}m)`);
      return null;
    }

    // Vérifier si c'est proche de la dernière position
    const lastLocation = await this.getLastUserLocation(userId);
    if (lastLocation) {
      const distance = this.calculateDistance(
        lastLocation.latitude, lastLocation.longitude,
        latitude, longitude
      );
      
      // Ignorer si moins de 50m de différence et moins de 5 min
      const timeDiff = Date.now() - new Date(lastLocation.createdAt).getTime();
      if (distance < 50 && timeDiff < 5 * 60 * 1000) {
        return lastLocation;
      }
    }

    const location = await this.prisma.locationHistory.create({
      data: {
        userId,
        latitude,
        longitude,
        accuracy,
        address,
        city,
        country,
        source
      }
    });

    // Traitement asynchrone des géofences et proximité
    setImmediate(() => {
      this.processGeofences(userId, latitude, longitude);
      this.checkProximityNotifications(userId, latitude, longitude);
    });

    return location;
  }

  /**
   * Obtenir l'historique des positions d'un utilisateur
   */
  async getUserLocationHistory(userId, options = {}) {
    const { 
      limit = 50, 
      startDate, 
      endDate, 
      includeCity = false 
    } = options;

    const whereClause = { userId };
    
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = new Date(startDate);
      if (endDate) whereClause.createdAt.lte = new Date(endDate);
    }

    const locations = await this.prisma.locationHistory.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        latitude: true,
        longitude: true,
        accuracy: true,
        address: true,
        city: includeCity,
        source: true,
        createdAt: true
      }
    });

    return locations;
  }

  /**
   * Obtenir la dernière position d'un utilisateur
   */
  async getLastUserLocation(userId) {
    return await this.prisma.locationHistory.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Nettoyer l'historique ancien
   */
  async cleanOldHistory() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.MAX_HISTORY_DAYS);

    const deleted = await this.prisma.locationHistory.deleteMany({
      where: {
        createdAt: { lt: cutoffDate }
      }
    });

    console.log(`🧹 ${deleted.count} positions anciennes supprimées`);
    return deleted.count;
  }

  // =============================================================================
  // ZONES FAVORITES
  // =============================================================================

  /**
   * Créer une zone favorite
   */
  async createFavoriteZone(userId, zoneData) {
    const { 
      name, 
      description, 
      latitude, 
      longitude, 
      radius = this.config.DEFAULT_GEOFENCE_RADIUS,
      color = '#3B82F6',
      notifyOnEnter = false,
      notifyOnExit = false
    } = zoneData;

    const zone = await this.prisma.favoriteZone.create({
      data: {
        userId,
        name,
        description,
        latitude,
        longitude,
        radius,
        color,
        notifyOnEnter,
        notifyOnExit
      }
    });

    console.log(`📍 Zone favorite créée: ${name} (${radius}m)`);
    return zone;
  }

  /**
   * Obtenir les zones favorites d'un utilisateur
   */
  async getUserFavoriteZones(userId) {
    return await this.prisma.favoriteZone.findMany({
      where: { 
        userId,
        isActive: true 
      },
      include: {
        visits: {
          where: { exitedAt: null }, // Visites en cours
          take: 1,
          orderBy: { enteredAt: 'desc' }
        },
        _count: {
          select: { visits: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Mettre à jour une zone favorite
   */
  async updateFavoriteZone(userId, zoneId, updateData) {
    const zone = await this.prisma.favoriteZone.updateMany({
      where: { 
        id: zoneId,
        userId // Sécurité : seul le propriétaire peut modifier
      },
      data: updateData
    });

    if (zone.count === 0) {
      throw new Error('Zone introuvable ou accès non autorisé');
    }

    return await this.prisma.favoriteZone.findUnique({
      where: { id: zoneId }
    });
  }

  /**
   * Supprimer une zone favorite
   */
  async deleteFavoriteZone(userId, zoneId) {
    const deleted = await this.prisma.favoriteZone.deleteMany({
      where: { 
        id: zoneId,
        userId
      }
    });

    if (deleted.count === 0) {
      throw new Error('Zone introuvable ou accès non autorisé');
    }

    return { success: true };
  }

  // =============================================================================
  // GÉOFENCING
  // =============================================================================

  /**
   * Traiter les géofences pour une position
   */
  async processGeofences(userId, latitude, longitude) {
    const zones = await this.prisma.favoriteZone.findMany({
      where: { 
        userId,
        isActive: true 
      }
    });

    for (const zone of zones) {
      const distance = this.calculateDistance(
        zone.latitude, zone.longitude,
        latitude, longitude
      );

      const isInZone = distance <= zone.radius;
      
      // Vérifier la visite en cours
      const currentVisit = await this.prisma.zoneVisit.findFirst({
        where: {
          userId,
          zoneId: zone.id,
          exitedAt: null
        }
      });

      if (isInZone && !currentVisit) {
        // Entrée dans la zone
        await this.handleZoneEntry(userId, zone);
      } else if (!isInZone && currentVisit) {
        // Sortie de la zone
        await this.handleZoneExit(userId, zone, currentVisit);
      }
    }
  }

  /**
   * Gérer l'entrée dans une zone
   */
  async handleZoneEntry(userId, zone) {
    // Créer la visite
    const visit = await this.prisma.zoneVisit.create({
      data: {
        userId,
        zoneId: zone.id
      }
    });

    // Créer l'alerte si activée
    if (zone.notifyOnEnter) {
      await this.createGeofenceAlert(userId, 'ZONE_ENTER', zone.id, {
        title: `Entrée dans ${zone.name}`,
        message: `Vous êtes entré dans votre zone "${zone.name}"`
      });
    }

    // Notification WebSocket
    if (this.webSocketService) {
      this.webSocketService.notifyGeofenceEvent(userId, {
        type: 'zone_enter',
        zone: {
          id: zone.id,
          name: zone.name,
          latitude: zone.latitude,
          longitude: zone.longitude
        },
        timestamp: new Date()
      });
    }

    console.log(`📍 ${userId} est entré dans la zone ${zone.name}`);
    return visit;
  }

  /**
   * Gérer la sortie d'une zone
   */
  async handleZoneExit(userId, zone, currentVisit) {
    const exitTime = new Date();
    const duration = Math.round((exitTime - new Date(currentVisit.enteredAt)) / 60000); // minutes

    // Mettre à jour la visite
    await this.prisma.zoneVisit.update({
      where: { id: currentVisit.id },
      data: {
        exitedAt: exitTime,
        duration
      }
    });

    // Créer l'alerte si activée
    if (zone.notifyOnExit) {
      await this.createGeofenceAlert(userId, 'ZONE_EXIT', zone.id, {
        title: `Sortie de ${zone.name}`,
        message: `Vous avez quitté votre zone "${zone.name}" après ${duration} minutes`
      });
    }

    // Notification WebSocket
    if (this.webSocketService) {
      this.webSocketService.notifyGeofenceEvent(userId, {
        type: 'zone_exit',
        zone: {
          id: zone.id,
          name: zone.name,
          latitude: zone.latitude,
          longitude: zone.longitude
        },
        duration,
        timestamp: new Date()
      });
    }

    console.log(`📍 ${userId} est sorti de la zone ${zone.name} (${duration}min)`);
  }

  // =============================================================================
  // ALERTES ET NOTIFICATIONS
  // =============================================================================

  /**
   * Créer une alerte géofence
   */
  async createGeofenceAlert(userId, type, zoneId, { title, message, latitude, longitude }) {
    return await this.prisma.geofenceAlert.create({
      data: {
        userId,
        type,
        zoneId,
        latitude,
        longitude,
        title,
        message
      }
    });
  }

  /**
   * Obtenir les alertes d'un utilisateur
   */
  async getUserAlerts(userId, options = {}) {
    const { limit = 20, unreadOnly = false } = options;

    const whereClause = { userId };
    if (unreadOnly) {
      whereClause.isRead = false;
    }

    return await this.prisma.geofenceAlert.findMany({
      where: whereClause,
      include: {
        zone: {
          select: {
            name: true,
            color: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  /**
   * Marquer les alertes comme lues
   */
  async markAlertsAsRead(userId, alertIds) {
    return await this.prisma.geofenceAlert.updateMany({
      where: {
        userId,
        id: { in: alertIds }
      },
      data: { isRead: true }
    });
  }

  // =============================================================================
  // NOTIFICATIONS DE PROXIMITÉ
  // =============================================================================

  /**
   * Vérifier les notifications de proximité
   */
  async checkProximityNotifications(userId, latitude, longitude) {
    // Vérifier les BAMs proches
    await this.checkNearbyBAMs(userId, latitude, longitude);
    
    // Vérifier les utilisateurs proches (optionnel, selon privacy)
    // await this.checkNearbyUsers(userId, latitude, longitude);
  }

  /**
   * Vérifier les BAMs proches
   */
  async checkNearbyBAMs(userId, latitude, longitude) {
    const nearbyBAMs = await this.prisma.bam.findMany({
      where: {
        userId: { not: userId }, // Pas ses propres BAMs
        expiresAt: { gt: new Date() } // BAMs actives
      },
      select: {
        id: true,
        text: true,
        latitude: true,
        longitude: true,
        user: {
          select: { pseudo: true }
        }
      }
    });

    for (const bam of nearbyBAMs) {
      const distance = this.calculateDistance(
        bam.latitude, bam.longitude,
        latitude, longitude
      );

      if (distance <= this.config.PROXIMITY_THRESHOLD) {
        // Vérifier si déjà notifié récemment
        const recentNotification = await this.prisma.proximityNotification.findFirst({
          where: {
            userId,
            targetType: 'BAM',
            targetId: bam.id,
            notifiedAt: {
              gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24h
            }
          }
        });

        if (!recentNotification) {
          await this.createProximityNotification(userId, 'BAM', bam.id, Math.round(distance));
          
          // Notification WebSocket
          if (this.webSocketService) {
            this.webSocketService.notifyProximityAlert(userId, {
              type: 'bam_nearby',
              bam: {
                id: bam.id,
                text: bam.text.substring(0, 50) + '...',
                creator: bam.user.pseudo
              },
              distance: Math.round(distance),
              timestamp: new Date()
            });
          }
        }
      }
    }
  }

  /**
   * Créer une notification de proximité
   */
  async createProximityNotification(userId, targetType, targetId, distance) {
    return await this.prisma.proximityNotification.create({
      data: {
        userId,
        targetType,
        targetId,
        distance
      }
    });
  }

  // =============================================================================
  // UTILITAIRES
  // =============================================================================

  /**
   * Calculer la distance entre deux points (Haversine)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Rayon de la Terre en mètres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance en mètres
  }

  /**
   * Vérifier si un point est dans un rayon
   */
  isWithinRadius(centerLat, centerLon, pointLat, pointLon, radius) {
    const distance = this.calculateDistance(centerLat, centerLon, pointLat, pointLon);
    return distance <= radius;
  }

  /**
   * Obtenir les statistiques de géolocalisation
   */
  async getUserLocationStats(userId) {
    const [
      totalLocations,
      favoriteZones,
      totalVisits,
      alerts,
      recentActivity
    ] = await Promise.all([
      this.prisma.locationHistory.count({ where: { userId } }),
      this.prisma.favoriteZone.count({ where: { userId, isActive: true } }),
      this.prisma.zoneVisit.count({ where: { userId } }),
      this.prisma.geofenceAlert.count({ where: { userId, isRead: false } }),
      this.prisma.locationHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          city: true,
          createdAt: true,
          source: true
        }
      })
    ]);

    // Calculer les villes visitées
    const cities = await this.prisma.locationHistory.groupBy({
      by: ['city'],
      where: {
        userId,
        city: { not: null }
      },
      _count: true
    });

    return {
      totalLocations,
      favoriteZones,
      totalVisits,
      unreadAlerts: alerts,
      citiesVisited: cities.length,
      topCities: cities
        .sort((a, b) => b._count - a._count)
        .slice(0, 5)
        .map(c => ({ city: c.city, visits: c._count })),
      recentActivity
    };
  }
}

// Export du singleton
const advancedLocationService = new AdvancedLocationService();
module.exports = advancedLocationService;