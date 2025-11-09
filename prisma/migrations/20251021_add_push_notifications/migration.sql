-- CreateIndex
-- Migration pour ajouter les fonctionnalités de push notifications

-- Ajouter les colonnes pour les push notifications à la table User
ALTER TABLE "User" ADD COLUMN "fcmToken" TEXT;
ALTER TABLE "User" ADD COLUMN "pushEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Créer un index sur le token FCM pour les recherches rapides
CREATE INDEX "User_fcmToken_idx" ON "User"("fcmToken");

-- Commentaires pour documentation
COMMENT ON COLUMN "User"."fcmToken" IS 'Token Firebase Cloud Messaging pour les notifications push';
COMMENT ON COLUMN "User"."pushEnabled" IS 'Préférence utilisateur pour recevoir les notifications push';