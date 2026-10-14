-- AlterTable
ALTER TABLE "EmailLog" ADD COLUMN     "groupId" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "billToAddress" TEXT,
ADD COLUMN     "billToTaxId" TEXT,
ADD COLUMN     "groupId" TEXT,
ALTER COLUMN "reservationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "occupantName" TEXT;

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "contactName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationGroup" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bookerId" TEXT NOT NULL,
    "companyId" TEXT,
    "singleBill" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservationGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_taxId_key" ON "Company"("taxId");

-- CreateIndex
CREATE UNIQUE INDEX "ReservationGroup_code_key" ON "ReservationGroup"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_groupId_key" ON "Invoice"("groupId");

-- CreateIndex
CREATE INDEX "Reservation_groupId_idx" ON "Reservation"("groupId");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ReservationGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationGroup" ADD CONSTRAINT "ReservationGroup_bookerId_fkey" FOREIGN KEY ("bookerId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationGroup" ADD CONSTRAINT "ReservationGroup_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ReservationGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ReservationGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- An invoice belongs to exactly one reservation or one group.
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_owner_check" CHECK (("reservationId" IS NULL) <> ("groupId" IS NULL));
