-- Fonctions PostgreSQL optimisées pour Supabase
-- À exécuter dans l'éditeur SQL de Supabase

-- Extension PostGIS pour géolocalisation avancée
CREATE EXTENSION IF NOT EXISTS postgis;

-- Fonction de recherche géographique optimisée (rayon par défaut 10km)
CREATE OR REPLACE FUNCTION find_nearby_users(
    user_lat DECIMAL,
    user_lng DECIMAL,
    radius_meters INTEGER DEFAULT 10000
)
RETURNS TABLE (
    id UUID,
    username TEXT,
    distance_meters DECIMAL,
    last_seen_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.username,
        ST_Distance(
            ST_GeogFromText('POINT(' || user_lng || ' ' || user_lat || ')'),
            ST_GeogFromText('POINT(' || u.longitude || ' ' || u.latitude || ')')
        ) as distance_meters,
        u.last_seen_at
    FROM "User" u
    WHERE u.latitude IS NOT NULL 
      AND u.longitude IS NOT NULL
      AND ST_DWithin(
          ST_GeogFromText('POINT(' || user_lng || ' ' || user_lat || ')'),
          ST_GeogFromText('POINT(' || u.longitude || ' ' || u.latitude || ')'),
          radius_meters
      )
    ORDER BY distance_meters ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction analytics avancée
CREATE OR REPLACE FUNCTION get_analytics(
    start_date DATE,
    end_date DATE
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'period', json_build_object(
            'start', start_date,
            'end', end_date
        ),
        'bams', json_build_object(
            'total', (SELECT COUNT(*) FROM "Bam" WHERE "createdAt"::date BETWEEN start_date AND end_date),
            'by_category', (
                SELECT json_object_agg(category, count)
                FROM (
                    SELECT category, COUNT(*) as count
                    FROM "Bam" 
                    WHERE "createdAt"::date BETWEEN start_date AND end_date
                    GROUP BY category
                ) t
            ),
            'by_status', (
                SELECT json_object_agg(status, count)
                FROM (
                    SELECT status, COUNT(*) as count
                    FROM "Bam" 
                    WHERE "createdAt"::date BETWEEN start_date AND end_date
                    GROUP BY status
                ) t
            )
        ),
        'users', json_build_object(
            'active', (
                SELECT COUNT(DISTINCT "userId") 
                FROM "Bam" 
                WHERE "createdAt"::date BETWEEN start_date AND end_date
            ),
            'new', (
                SELECT COUNT(*) 
                FROM "User" 
                WHERE "createdAt"::date BETWEEN start_date AND end_date
            ),
            'top_contributors', (
                SELECT json_agg(
                    json_build_object(
                        'userId', "userId",
                        'username', u.username,
                        'bam_count', bam_count
                    )
                )
                FROM (
                    SELECT b."userId", u.username, COUNT(*) as bam_count
                    FROM "Bam" b
                    JOIN "User" u ON b."userId" = u.id
                    WHERE b."createdAt"::date BETWEEN start_date AND end_date
                    GROUP BY b."userId", u.username
                    ORDER BY bam_count DESC
                    LIMIT 10
                ) top_users
            )
        ),
        'engagement', json_build_object(
            'total_reviews', (
                SELECT COUNT(*) 
                FROM "Review" 
                WHERE "createdAt"::date BETWEEN start_date AND end_date
            ),
            'total_calls', (
                SELECT COUNT(*) 
                FROM "Call" 
                WHERE "createdAt"::date BETWEEN start_date AND end_date
            ),
            'points_distributed', (
                SELECT COALESCE(SUM("totalPoints"), 0)
                FROM "User"
                WHERE "updatedAt"::date BETWEEN start_date AND end_date
            )
        ),
        'geographic', json_build_object(
            'bams_with_location', (
                SELECT COUNT(*) 
                FROM "Bam" 
                WHERE latitude IS NOT NULL 
                  AND longitude IS NOT NULL
                  AND "createdAt"::date BETWEEN start_date AND end_date
            ),
            'favorite_zones_created', (
                SELECT COUNT(*) 
                FROM "FavoriteZone" 
                WHERE "createdAt"::date BETWEEN start_date AND end_date
            )
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour notifications real-time
CREATE OR REPLACE FUNCTION notify_bam_created()
RETURNS TRIGGER AS $$
BEGIN
    -- Notification real-time via Supabase
    PERFORM pg_notify('bam_created', json_build_object(
        'id', NEW.id,
        'userId', NEW."userId",
        'category', NEW.category,
        'latitude', NEW.latitude,
        'longitude', NEW.longitude,
        'timestamp', NEW."createdAt"
    )::text);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bam_created_trigger
    AFTER INSERT ON "Bam"
    FOR EACH ROW
    EXECUTE FUNCTION notify_bam_created();

-- Trigger pour gamification automatique
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Mise à jour des statistiques utilisateur
    UPDATE "User" 
    SET 
        "bamCount" = (SELECT COUNT(*) FROM "Bam" WHERE "userId" = NEW."userId"),
        "totalPoints" = "totalPoints" + 10, -- Points pour nouveau BAM
        "lastActivity" = NOW()
    WHERE id = NEW."userId";
    
    -- Vérification des badges
    PERFORM check_and_award_badges(NEW."userId");
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_stats_trigger
    AFTER INSERT ON "Bam"
    FOR EACH ROW
    EXECUTE FUNCTION update_user_stats();

-- Fonction de vérification des badges
CREATE OR REPLACE FUNCTION check_and_award_badges(user_id UUID)
RETURNS VOID AS $$
DECLARE
    user_bam_count INTEGER;
    user_streak INTEGER;
BEGIN
    -- Récupération des stats utilisateur
    SELECT "bamCount", "currentStreak" 
    INTO user_bam_count, user_streak
    FROM "User" 
    WHERE id = user_id;
    
    -- Badge Premier BAM
    IF user_bam_count = 1 THEN
        INSERT INTO "UserBadge" ("userId", "badgeId", "earnedAt")
        SELECT user_id, 'first-bam', NOW()
        WHERE NOT EXISTS (
            SELECT 1 FROM "UserBadge" 
            WHERE "userId" = user_id AND "badgeId" = 'first-bam'
        );
    END IF;
    
    -- Badge 10 BAMs
    IF user_bam_count = 10 THEN
        INSERT INTO "UserBadge" ("userId", "badgeId", "earnedAt")
        SELECT user_id, 'bam-collector', NOW()
        WHERE NOT EXISTS (
            SELECT 1 FROM "UserBadge" 
            WHERE "userId" = user_id AND "badgeId" = 'bam-collector'
        );
    END IF;
    
    -- Badge Série de 7 jours
    IF user_streak = 7 THEN
        INSERT INTO "UserBadge" ("userId", "badgeId", "earnedAt")
        SELECT user_id, 'week-streak', NOW()
        WHERE NOT EXISTS (
            SELECT 1 FROM "UserBadge" 
            WHERE "userId" = user_id AND "badgeId" = 'week-streak'
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Index pour optimiser les performances
CREATE INDEX IF NOT EXISTS idx_bam_location ON "Bam" USING GIST (ST_Point(longitude, latitude));
CREATE INDEX IF NOT EXISTS idx_user_location ON "User" USING GIST (ST_Point(longitude, latitude));
CREATE INDEX IF NOT EXISTS idx_bam_created_at ON "Bam" ("createdAt");
CREATE INDEX IF NOT EXISTS idx_bam_user_id ON "Bam" ("userId");
CREATE INDEX IF NOT EXISTS idx_user_badge_user_id ON "UserBadge" ("userId");

-- Politique RLS (Row Level Security)
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Bam" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Review" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Call" ENABLE ROW LEVEL SECURITY;

-- Politiques de sécurité
CREATE POLICY "Users can view their own data" ON "User"
    FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users can create BAMs" ON "Bam"
    FOR INSERT WITH CHECK (auth.uid() = "userId");

CREATE POLICY "Users can view public BAMs" ON "Bam"
    FOR SELECT USING (true);

CREATE POLICY "Users can update their own BAMs" ON "Bam"
    FOR UPDATE USING (auth.uid() = "userId");