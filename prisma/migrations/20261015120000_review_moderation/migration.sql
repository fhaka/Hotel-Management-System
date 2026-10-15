-- Review moderation: status instead of a published flag, category ratings and management replies.

CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'PUBLISHED', 'HIDDEN');

ALTER TABLE "Review"
  ADD COLUMN "ratingCleanliness" INTEGER,
  ADD COLUMN "ratingRooms" INTEGER,
  ADD COLUMN "ratingService" INTEGER,
  ADD COLUMN "ratingValue" INTEGER,
  ADD COLUMN "respondedAt" TIMESTAMP(3),
  ADD COLUMN "respondedById" TEXT,
  ADD COLUMN "response" TEXT,
  ADD COLUMN "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Keep existing moderation decisions.
UPDATE "Review" SET "status" = CASE WHEN "published" THEN 'PUBLISHED'::"ReviewStatus" ELSE 'HIDDEN'::"ReviewStatus" END;

ALTER TABLE "Review" DROP COLUMN "published";
ALTER TABLE "Review" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "Review" ADD CONSTRAINT "Review_ratings_range" CHECK (
  "rating" BETWEEN 1 AND 5
  AND ("ratingRooms" IS NULL OR "ratingRooms" BETWEEN 1 AND 5)
  AND ("ratingService" IS NULL OR "ratingService" BETWEEN 1 AND 5)
  AND ("ratingCleanliness" IS NULL OR "ratingCleanliness" BETWEEN 1 AND 5)
  AND ("ratingValue" IS NULL OR "ratingValue" BETWEEN 1 AND 5)
);

CREATE INDEX "Review_status_createdAt_idx" ON "Review"("status", "createdAt");

ALTER TABLE "Review" ADD CONSTRAINT "Review_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
