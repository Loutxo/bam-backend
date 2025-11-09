# Configuration optimisée pour Supabase + Vercel

## 🎯 Configuration des variables d'environnement

### .env.local (Développement)
```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key

# Base de données
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres

# Push Notifications
FCM_SERVER_KEY=your-fcm-server-key
APNS_JWT_TOKEN=your-apns-jwt-token
APNS_BUNDLE_ID=com.yourapp.bam

# AI Moderation (optionnel)
OPENAI_API_KEY=your-openai-key

# App Config
NODE_ENV=development
PORT=3000
```

### .env.production (Vercel)
```env
# Même configuration mais avec les valeurs de production
# À configurer dans Vercel Dashboard > Settings > Environment Variables
```

## 🚀 Optimisations spécifiques

### 1. Real-time avec Supabase
```javascript
// Configuration WebSocket optimisée
const setupRealtime = () => {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    realtime: {
      params: {
        eventsPerSecond: 10 // Limiter pour économiser la bande passante
      }
    }
  });

  // Écoute ciblée par zone géographique
  const subscribeToZone = (lat, lng, radius) => {
    return supabase
      .from('Bam')
      .on('INSERT', payload => {
        const bam = payload.new;
        if (isInRadius(bam.latitude, bam.longitude, lat, lng, radius)) {
          handleNewBam(bam);
        }
      })
      .subscribe();
  };
};
```

### 2. Géolocalisation avec PostGIS
```sql
-- Index spatial optimisé
CREATE INDEX idx_bam_geom ON "Bam" USING GIST (ST_Point(longitude, latitude));

-- Recherche ultra-rapide
CREATE OR REPLACE FUNCTION find_nearby_bams_optimized(
    user_lat DECIMAL,
    user_lng DECIMAL,
    radius_meters INTEGER DEFAULT 1000
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    category TEXT,
    distance_meters DECIMAL,
    created_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id,
        b.title,
        b.category,
        ST_Distance(
            ST_Point(user_lng, user_lat)::geography,
            ST_Point(b.longitude, b.latitude)::geography
        ) as distance_meters,
        b."createdAt"
    FROM "Bam" b
    WHERE b.latitude IS NOT NULL 
      AND b.longitude IS NOT NULL
      AND ST_DWithin(
          ST_Point(user_lng, user_lat)::geography,
          ST_Point(b.longitude, b.latitude)::geography,
          radius_meters
      )
    ORDER BY distance_meters ASC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3. Cache intelligent
```javascript
// Cache Redis avec Supabase Edge Functions
const getCachedBams = async (lat, lng, radius) => {
  const cacheKey = `bams:${lat}:${lng}:${radius}`;
  
  // Vérifier le cache Redis
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Requête Supabase si pas en cache
  const { data } = await supabase.rpc('find_nearby_bams_optimized', {
    user_lat: lat,
    user_lng: lng,
    radius_meters: radius
  });
  
  // Mettre en cache pour 5 minutes
  await redis.setex(cacheKey, 300, JSON.stringify(data));
  
  return data;
};
```

### 4. Monitoring et observabilité
```javascript
// Monitoring avec Supabase Analytics
const trackBamEvent = async (event, bamId, userId, metadata = {}) => {
  await supabase
    .from('analytics_events')
    .insert({
      event_type: event,
      bam_id: bamId,
      user_id: userId,
      metadata,
      timestamp: new Date().toISOString(),
      session_id: getSessionId()
    });
};

// Métriques performance
const measurePerformance = (operation) => {
  return async (...args) => {
    const start = Date.now();
    try {
      const result = await operation(...args);
      const duration = Date.now() - start;
      
      // Log performance
      console.log(`Operation ${operation.name} took ${duration}ms`);
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      console.error(`Operation ${operation.name} failed after ${duration}ms:`, error);
      throw error;
    }
  };
};
```

## 📊 Architecture de données optimisée

### Partitioning par date
```sql
-- Partition des BAMs par mois pour les performances
CREATE TABLE bam_y2024m01 PARTITION OF "Bam"
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE bam_y2024m02 PARTITION OF "Bam"
FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
```

### Materialized Views
```sql
-- Vue matérialisée pour les statistiques
CREATE MATERIALIZED VIEW bam_stats_daily AS
SELECT 
    DATE(created_at) as date,
    category,
    COUNT(*) as bam_count,
    AVG(severity::integer) as avg_severity
FROM "Bam"
GROUP BY DATE(created_at), category;

-- Refresh automatique
CREATE OR REPLACE FUNCTION refresh_bam_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY bam_stats_daily;
END;
$$ LANGUAGE plpgsql;

-- Trigger de refresh
CREATE TRIGGER refresh_stats_trigger
    AFTER INSERT OR UPDATE OR DELETE ON "Bam"
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_bam_stats();
```

## 🔒 Sécurité avancée

### RLS (Row Level Security) granulaire
```sql
-- Politique pour la géolocalisation
CREATE POLICY "Users can only see BAMs within their radius" ON "Bam"
    FOR SELECT USING (
        CASE 
            WHEN auth.jwt() ->> 'role' = 'admin' THEN true
            ELSE ST_DWithin(
                ST_Point(longitude, latitude)::geography,
                ST_Point(
                    (auth.jwt() ->> 'user_metadata')::json ->> 'longitude',
                    (auth.jwt() ->> 'user_metadata')::json ->> 'latitude'
                )::geography,
                50000 -- 50km max
            )
        END
    );
```

### Rate limiting avec Edge Functions
```typescript
// Edge Function pour rate limiting
const rateLimiter = new Map();

const checkRateLimit = (userId: string, action: string) => {
  const key = `${userId}:${action}`;
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxRequests = 10;
  
  if (!rateLimiter.has(key)) {
    rateLimiter.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  const bucket = rateLimiter.get(key);
  
  if (now > bucket.resetTime) {
    bucket.count = 1;
    bucket.resetTime = now + windowMs;
    return true;
  }
  
  if (bucket.count >= maxRequests) {
    return false;
  }
  
  bucket.count++;
  return true;
};
```

## 📱 PWA optimisée

### Service Worker pour offline
```javascript
// sw.js - Cache intelligent
const CACHE_NAME = 'bam-v1';
const OFFLINE_URLS = [
  '/',
  '/offline.html',
  '/static/js/main.js',
  '/static/css/main.css'
];

// Cache des BAMs récents pour mode offline
self.addEventListener('fetch', event => {
  if (event.request.url.includes('/api/bams/nearby')) {
    event.respondWith(
      caches.open('bams-cache').then(cache => {
        return fetch(event.request)
          .then(response => {
            cache.put(event.request, response.clone());
            return response;
          })
          .catch(() => {
            return cache.match(event.request);
          });
      })
    );
  }
});
```

## 🎯 Recommandations de déploiement

### Vercel Edge Functions
```javascript
// api/bams/nearby.js - Edge Function
export const config = {
  runtime: 'edge',
  regions: ['fra1', 'cdg1'] // Europe pour la latence
};

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  
  // Utiliser Vercel Edge Network pour le cache
  const cacheKey = `bams-${lat}-${lng}`;
  
  return new Response(JSON.stringify(result), {
    headers: {
      'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
      'Content-Type': 'application/json'
    }
  });
}
```

### Configuration Vercel optimale
```json
{
  "functions": {
    "api/bams/**.js": {
      "maxDuration": 30
    }
  },
  "regions": ["fra1"],
  "crons": [
    {
      "path": "/api/maintenance/cleanup",
      "schedule": "0 2 * * *"
    }
  ]
}
```

Votre stack Supabase + Vercel est maintenant optimisée pour :
✅ **Performance** : PostGIS + cache + Edge Functions  
✅ **Scalabilité** : Auto-scaling Vercel + Supabase  
✅ **Real-time** : WebSocket Supabase optimisés  
✅ **Sécurité** : RLS + rate limiting + modération IA  
✅ **Monitoring** : Analytics intégrées + logging  

Voulez-vous que je vous aide à déployer cette configuration optimisée ? 🚀