-- Migration simplifiée BAM API pour Supabase (sans PostGIS d'abord)
-- Projet: tzlomhuhtmocywpjpyxd

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS "User" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "firstName" VARCHAR(100),
    "lastName" VARCHAR(100),
    "phoneNumber" VARCHAR(20),
    "profilePicture" VARCHAR(500),
    
    -- Gamification
    "totalPoints" INTEGER DEFAULT 0,
    "currentLevel" INTEGER DEFAULT 1,
    "badgeCount" INTEGER DEFAULT 0,
    "currentStreak" INTEGER DEFAULT 0,
    "longestStreak" INTEGER DEFAULT 0,
    
    -- Géolocalisation (coordonnées simples)
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    "locationAccuracy" DECIMAL(8, 2),
    "locationUpdatedAt" TIMESTAMP WITH TIME ZONE,
    
    -- Statistiques d'activité
    "bamCount" INTEGER DEFAULT 0,
    "reviewCount" INTEGER DEFAULT 0,
    "callCount" INTEGER DEFAULT 0,
    "lastActivity" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Métadonnées
    "isVerified" BOOLEAN DEFAULT FALSE,
    "isActive" BOOLEAN DEFAULT TRUE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des BAMs
CREATE TABLE IF NOT EXISTS "Bam" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    
    -- Contenu
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    subcategory VARCHAR(50),
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Géolocalisation
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    address TEXT,
    "locationAccuracy" DECIMAL(8, 2),
    
    -- Statut et workflow
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'rejected')),
    priority INTEGER DEFAULT 0,
    "assignedTo" UUID REFERENCES "User"(id),
    "resolvedAt" TIMESTAMP WITH TIME ZONE,
    "resolvedBy" UUID REFERENCES "User"(id),
    
    -- Engagement
    "viewCount" INTEGER DEFAULT 0,
    "likeCount" INTEGER DEFAULT 0,
    "shareCount" INTEGER DEFAULT 0,
    "commentCount" INTEGER DEFAULT 0,
    
    -- Modération et qualité
    "moderationScore" DECIMAL(3, 2) DEFAULT 0.95,
    "isAnonymous" BOOLEAN DEFAULT FALSE,
    "isVerified" BOOLEAN DEFAULT FALSE,
    
    -- Métadonnées
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "lastViewedAt" TIMESTAMP WITH TIME ZONE
);

-- Table des reviews
CREATE TABLE IF NOT EXISTS "Review" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "bamId" UUID NOT NULL REFERENCES "Bam"(id) ON DELETE CASCADE,
    "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    
    comment TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    "isHelpful" BOOLEAN DEFAULT FALSE,
    "moderationScore" DECIMAL(3, 2) DEFAULT 0.95,
    
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE("bamId", "userId")
);

-- Table des appels
CREATE TABLE IF NOT EXISTS "Call" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "bamId" UUID NOT NULL REFERENCES "Bam"(id) ON DELETE CASCADE,
    "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    
    "phoneNumber" VARCHAR(20),
    duration INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('completed', 'missed', 'busy', 'failed')),
    notes TEXT,
    
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des badges
CREATE TABLE IF NOT EXISTS "Badge" (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(200),
    category VARCHAR(50),
    "pointsRequired" INTEGER DEFAULT 0,
    "isActive" BOOLEAN DEFAULT TRUE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des badges utilisateurs
CREATE TABLE IF NOT EXISTS "UserBadge" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "badgeId" VARCHAR(50) NOT NULL REFERENCES "Badge"(id),
    "earnedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE("userId", "badgeId")
);

-- Table des zones favorites (sans PostGIS)
CREATE TABLE IF NOT EXISTS "FavoriteZone" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    radius INTEGER DEFAULT 10000, -- 10km par défaut
    
    "alertsEnabled" BOOLEAN DEFAULT TRUE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE("userId", name)
);

-- Fonction pour calculer la distance (formule Haversine simplifiée)
CREATE OR REPLACE FUNCTION calculate_distance(
    lat1 DECIMAL, lon1 DECIMAL,
    lat2 DECIMAL, lon2 DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
    earth_radius DECIMAL := 6371000; -- Rayon de la Terre en mètres
    dlat DECIMAL;
    dlon DECIMAL;
    a DECIMAL;
    c DECIMAL;
BEGIN
    dlat := RADIANS(lat2 - lat1);
    dlon := RADIANS(lon2 - lon1);
    
    a := SIN(dlat/2) * SIN(dlat/2) + COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * SIN(dlon/2) * SIN(dlon/2);
    c := 2 * ATAN2(SQRT(a), SQRT(1-a));
    
    RETURN earth_radius * c;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour trouver des utilisateurs proches (10km par défaut)
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
        calculate_distance(user_lat, user_lng, u.latitude, u.longitude) as distance_meters,
        u."lastActivity" as last_seen_at
    FROM "User" u
    WHERE u.latitude IS NOT NULL 
      AND u.longitude IS NOT NULL
      AND calculate_distance(user_lat, user_lng, u.latitude, u.longitude) <= radius_meters
    ORDER BY distance_meters ASC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Index optimisés
CREATE INDEX IF NOT EXISTS idx_user_email ON "User" (email);
CREATE INDEX IF NOT EXISTS idx_user_username ON "User" (username);
CREATE INDEX IF NOT EXISTS idx_user_location ON "User" (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bam_user_id ON "Bam" ("userId");
CREATE INDEX IF NOT EXISTS idx_bam_created_at ON "Bam" ("createdAt");
CREATE INDEX IF NOT EXISTS idx_bam_status ON "Bam" (status);
CREATE INDEX IF NOT EXISTS idx_bam_category ON "Bam" (category);
CREATE INDEX IF NOT EXISTS idx_bam_location ON "Bam" (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_review_bam_id ON "Review" ("bamId");
CREATE INDEX IF NOT EXISTS idx_call_bam_id ON "Call" ("bamId");
CREATE INDEX IF NOT EXISTS idx_user_badge_user_id ON "UserBadge" ("userId");

-- Triggers pour mise à jour automatique
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_updated_at BEFORE UPDATE ON "User" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bam_updated_at BEFORE UPDATE ON "Bam" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insertion des badges par défaut
INSERT INTO "Badge" (id, name, description, icon, category, "pointsRequired") VALUES
('first-bam', 'Premier BAM', 'Votre premier signalement', '🎯', 'engagement', 0),
('bam-collector', 'Collectionneur', '10 signalements créés', '📊', 'volume', 100),
('week-streak', 'Série hebdomadaire', '7 jours consécutifs d''activité', '🔥', 'consistency', 70),
('helpful-reviewer', 'Reviewer utile', '10 reviews créées', '⭐', 'community', 100),
('caller-bronze', 'Appelant bronze', '5 appels effectués', '📞', 'action', 50),
('geo-explorer', 'Explorateur géo', '3 zones favorites créées', '🗺️', 'exploration', 75)
ON CONFLICT (id) DO NOTHING;

-- Activer RLS
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Bam" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Review" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Call" ENABLE ROW LEVEL SECURITY;

-- Politique de base (à affiner selon auth)
CREATE POLICY "Enable read access for all users" ON "Bam" FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON "Bam" FOR INSERT WITH CHECK (true);