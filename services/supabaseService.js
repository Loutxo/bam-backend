/**
 * Configuration optimisée pour Supabase + Vercel
 * Services intégrés et real-time
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY; // Pour les opérations admin
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY; // Pour les clients

// Client admin (server-side)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Client public (pour real-time)
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

class SupabaseService {
  constructor() {
    this.admin = supabaseAdmin;
    this.client = supabaseClient;
  }

  // Géolocalisation avancée avec PostGIS (optimisé pour 10km)
  async findNearbyUsers(latitude, longitude, radiusMeters = 10000) {
    const { data, error } = await this.admin.rpc('find_nearby_users', {
      user_lat: latitude,
      user_lng: longitude,
      radius_meters: radiusMeters
    });

    if (error) throw new Error(`Géolocalisation error: ${error.message}`);
    return data;
  }

  // Real-time pour gamification
  setupGamificationRealtime(io) {
    // Écoute des nouveaux badges
    this.client
      .from('UserBadge')
      .on('INSERT', payload => {
        const { userId, badgeId } = payload.new;
        io.to(`user_${userId}`).emit('badge_earned', {
          badgeId,
          timestamp: new Date()
        });
      })
      .subscribe();

    // Écoute des mises à jour de points
    this.client
      .from('User')
      .on('UPDATE', payload => {
        const { id: userId, totalPoints, currentLevel } = payload.new;
        const oldLevel = payload.old.currentLevel;
        
        if (currentLevel > oldLevel) {
          io.to(`user_${userId}`).emit('level_up', {
            newLevel: currentLevel,
            totalPoints,
            timestamp: new Date()
          });
        }
      })
      .subscribe();
  }

  // Real-time pour géolocalisation  
  setupLocationRealtime(io) {
    // Écoute des nouveaux BAMs géolocalisés
    this.client
      .from('Bam')
      .on('INSERT', payload => {
        const bam = payload.new;
        if (bam.latitude && bam.longitude) {
          // Notifier les utilisateurs proches (rayon 10km)
          this.findNearbyUsers(bam.latitude, bam.longitude, 10000)
            .then(nearbyUsers => {
              nearbyUsers.forEach(user => {
                io.to(`user_${user.id}`).emit('nearby_bam', {
                  bamId: bam.id,
                  distance: user.distance,
                  timestamp: new Date()
                });
              });
            });
        }
      })
      .subscribe();
  }

  // Notifications push via Supabase Edge Functions
  async sendPushNotification(userId, notification) {
    const { data, error } = await this.admin.functions.invoke('send-push', {
      body: {
        userId,
        title: notification.title,
        body: notification.body,
        data: notification.data
      }
    });

    if (error) throw new Error(`Push notification error: ${error.message}`);
    return data;
  }

  // Analytics avancées
  async getAnalytics(startDate, endDate) {
    const { data, error } = await this.admin.rpc('get_analytics', {
      start_date: startDate,
      end_date: endDate
    });

    if (error) throw new Error(`Analytics error: ${error.message}`);
    return data;
  }

  // Modération automatique avec AI
  async moderateContent(content, contentType = 'text') {
    const { data, error } = await this.admin.functions.invoke('moderate-content', {
      body: {
        content,
        type: contentType
      }
    });

    if (error) throw new Error(`Moderation error: ${error.message}`);
    return data;
  }
}

module.exports = new SupabaseService();