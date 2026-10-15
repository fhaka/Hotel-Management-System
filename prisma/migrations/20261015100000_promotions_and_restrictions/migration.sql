-- CreateEnum
CREATE TYPE "PromoType" AS ENUM ('PERCENT', 'FIXED_PER_NIGHT');

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "promoCode" TEXT;

-- CreateTable
CREATE TABLE "StayRestriction" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "roomTypeId" TEXT,
    "weekdays" INTEGER[],
    "minNights" INTEGER,
    "closedToArrival" BOOLEAN NOT NULL DEFAULT false,
    "stopSell" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StayRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "PromoType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "validFrom" DATE,
    "validTo" DATE,
    "stayFrom" DATE,
    "stayTo" DATE,
    "minNights" INTEGER NOT NULL DEFAULT 1,
    "roomTypeIds" TEXT[],
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

-- AddForeignKey
ALTER TABLE "StayRestriction" ADD CONSTRAINT "StayRestriction_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
