-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'RECEPTIONIST', 'HOUSEKEEPING', 'GUEST');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('CLEAN', 'DIRTY', 'INSPECTED', 'OUT_OF_ORDER');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "BookingSource" AS ENUM ('WEBSITE', 'WALK_IN', 'PHONE', 'EMAIL', 'OTA', 'CORPORATE');

-- CreateEnum
CREATE TYPE "ChargeType" AS ENUM ('ROOM', 'SERVICE', 'CITY_TAX', 'DISCOUNT', 'FEE', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('CHARGE', 'REFUND');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'CASH', 'BANK_TRANSFER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('ISSUED', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('DINING', 'SPA', 'ROOM_SERVICE', 'MINIBAR', 'LAUNDRY', 'TRANSPORT', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('CHECKOUT_CLEAN', 'STAYOVER', 'INSPECTION', 'MAINTENANCE', 'TURNDOWN');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('SENT', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'GUEST',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "country" TEXT,
    "city" TEXT,
    "address" TEXT,
    "idType" TEXT,
    "idNumber" TEXT,
    "dateOfBirth" DATE,
    "vip" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomType" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "baseRate" DECIMAL(10,2) NOT NULL,
    "weekendRate" DECIMAL(10,2),
    "maxAdults" INTEGER NOT NULL,
    "maxChildren" INTEGER NOT NULL,
    "sizeSqm" INTEGER NOT NULL,
    "bedType" TEXT NOT NULL,
    "view" TEXT NOT NULL,
    "amenities" TEXT[],
    "images" TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "floor" INTEGER NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "status" "RoomStatus" NOT NULL DEFAULT 'CLEAN',
    "outOfOrderReason" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonalRate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "multiplier" DECIMAL(4,2) NOT NULL,
    "roomTypeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonalRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "roomId" TEXT,
    "checkIn" DATE NOT NULL,
    "checkOut" DATE NOT NULL,
    "adults" INTEGER NOT NULL,
    "children" INTEGER NOT NULL DEFAULT 0,
    "status" "ReservationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "source" "BookingSource" NOT NULL DEFAULT 'WEBSITE',
    "specialRequests" TEXT,
    "internalNotes" TEXT,
    "estimatedArrival" TEXT,
    "createdById" TEXT,
    "checkedInAt" TIMESTAMP(3),
    "checkedOutAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FolioCharge" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "type" "ChargeType" NOT NULL,
    "description" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL,
    "serviceId" TEXT,
    "postedById" TEXT,
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FolioCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "kind" "PaymentKind" NOT NULL DEFAULT 'CHARGE',
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'SUCCEEDED',
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "cardBrand" TEXT,
    "cardLast4" TEXT,
    "note" TEXT,
    "processedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'ISSUED',
    "netTotal" DECIMAL(10,2) NOT NULL,
    "vatTotal" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "billTo" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ServiceCategory" NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'item',
    "bookable" BOOLEAN NOT NULL DEFAULT false,
    "perNight" BOOLEAN NOT NULL DEFAULT false,
    "perGuest" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HousekeepingTask" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "type" "TaskType" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "notes" TEXT,
    "assignedToId" TEXT,
    "dueDate" DATE NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HousekeepingTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT,
    "guestName" TEXT NOT NULL,
    "country" TEXT,
    "rating" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "handled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL,
    "error" TEXT,
    "reservationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "vatRate" DECIMAL(5,2) NOT NULL,
    "cityTaxPerPersonNight" DECIMAL(10,2) NOT NULL,
    "checkInTime" TEXT NOT NULL,
    "checkOutTime" TEXT NOT NULL,
    "freeCancellationHours" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Guest_userId_key" ON "Guest"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Guest_email_key" ON "Guest"("email");

-- CreateIndex
CREATE INDEX "Guest_lastName_firstName_idx" ON "Guest"("lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX "RoomType_slug_key" ON "RoomType"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Room_number_key" ON "Room"("number");

-- CreateIndex
CREATE INDEX "Room_roomTypeId_idx" ON "Room"("roomTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_code_key" ON "Reservation"("code");

-- CreateIndex
CREATE INDEX "Reservation_checkIn_checkOut_idx" ON "Reservation"("checkIn", "checkOut");

-- CreateIndex
CREATE INDEX "Reservation_status_idx" ON "Reservation"("status");

-- CreateIndex
CREATE INDEX "Reservation_guestId_idx" ON "Reservation"("guestId");

-- CreateIndex
CREATE INDEX "Reservation_roomId_idx" ON "Reservation"("roomId");

-- CreateIndex
CREATE INDEX "FolioCharge_reservationId_idx" ON "FolioCharge"("reservationId");

-- CreateIndex
CREATE INDEX "Payment_reservationId_idx" ON "Payment"("reservationId");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_reservationId_key" ON "Invoice"("reservationId");

-- CreateIndex
CREATE INDEX "HousekeepingTask_status_dueDate_idx" ON "HousekeepingTask"("status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Review_reservationId_key" ON "Review"("reservationId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonalRate" ADD CONSTRAINT "SeasonalRate_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioCharge" ADD CONSTRAINT "FolioCharge_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioCharge" ADD CONSTRAINT "FolioCharge_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioCharge" ADD CONSTRAINT "FolioCharge_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Guarantee: a physical room can never hold two overlapping active stays.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Reservation"
  ADD CONSTRAINT "Reservation_no_overlap"
  EXCLUDE USING gist (
    "roomId" WITH =,
    daterange("checkIn", "checkOut", '[)') WITH &&
  )
  WHERE ("roomId" IS NOT NULL AND status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN'));

ALTER TABLE "Reservation"
  ADD CONSTRAINT "Reservation_dates_valid" CHECK ("checkOut" > "checkIn");
