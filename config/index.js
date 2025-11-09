/**
 * Configuration centralisée de l'application BAM
 */

const config = {
  // Configuration serveur
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
  },

  // Configuration base de données
  database: {
    url: process.env.DATABASE_URL,
  },

  // Configuration JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'your-fallback-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  // Configuration sécurité
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION) || 30 * 60 * 1000, // 30 min
  },

  // Configuration CORS
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },

  // Configuration géolocalisation
  geolocation: {
    defaultSearchRadiusKm: parseInt(process.env.DEFAULT_SEARCH_RADIUS_KM) || 2,
    maxSearchRadiusKm: parseInt(process.env.MAX_SEARCH_RADIUS_KM) || 10,
  },

  // Configuration BAMs
  bams: {
    defaultExpiryMinutes: parseInt(process.env.DEFAULT_BAM_EXPIRY_MINUTES) || 60,
    maxExpiryMinutes: parseInt(process.env.MAX_BAM_EXPIRY_MINUTES) || 1440, // 24h
    minExpiryMinutes: 5,
  },

  // Configuration rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 min
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  },

  // Configuration upload de fichiers
  upload: {
    maxFileSize: process.env.MAX_FILE_SIZE || '5mb',
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    uploadPath: process.env.UPLOAD_PATH || './uploads',
  },

  // Configuration logs
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },

  // Configuration validation
  validation: {
    user: {
      pseudoMinLength: 2,
      pseudoMaxLength: 50,
      phoneRegex: /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/,
    },
    bam: {
      textMinLength: 10,
      textMaxLength: 500,
      minPrice: 0,
      maxPrice: 10000,
    },
    message: {
      textMinLength: 1,
      textMaxLength: 1000,
    },
    review: {
      minRating: 0,
      maxRating: 5,
      commentMaxLength: 500,
    },
  },
};

// Validation de la configuration au démarrage
const validateConfig = () => {
  const requiredEnvVars = ['DATABASE_URL'];
  const productionEnvVars = ['JWT_SECRET'];

  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);

  if (missing.length > 0) {
    throw new Error(`Variables d'environnement manquantes: ${missing.join(', ')}`);
  }

  // Vérifications pour la production
  if (process.env.NODE_ENV === 'production') {
    const missingProd = productionEnvVars.filter(envVar => !process.env[envVar]);
    if (missingProd.length > 0) {
      console.warn(`⚠️  Variables de production recommandées manquantes: ${missingProd.join(', ')}`);
    }
  }
};

module.exports = {
  config,
  validateConfig,
};
