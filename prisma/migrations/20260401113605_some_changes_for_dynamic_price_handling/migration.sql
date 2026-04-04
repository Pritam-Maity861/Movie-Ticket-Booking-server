/*
  Warnings:

  - You are about to drop the column `price` on the `Showtime` table. All the data in the column will be lost.
  - Changed the type of `type` on the `Seat` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "SeatType" AS ENUM ('REGULAR', 'PREMIUM', 'VIP');

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "personPic" TEXT;

-- AlterTable
ALTER TABLE "Seat" DROP COLUMN "type",
ADD COLUMN     "type" "SeatType" NOT NULL;

-- AlterTable
ALTER TABLE "Showtime" DROP COLUMN "price";

-- CreateTable
CREATE TABLE "SeatPricing" (
    "id" TEXT NOT NULL,
    "showtimeId" TEXT NOT NULL,
    "seatType" "SeatType" NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeatPricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SeatPricing_showtimeId_idx" ON "SeatPricing"("showtimeId");

-- CreateIndex
CREATE UNIQUE INDEX "SeatPricing_showtimeId_seatType_key" ON "SeatPricing"("showtimeId", "seatType");

-- AddForeignKey
ALTER TABLE "SeatPricing" ADD CONSTRAINT "SeatPricing_showtimeId_fkey" FOREIGN KEY ("showtimeId") REFERENCES "Showtime"("id") ON DELETE CASCADE ON UPDATE CASCADE;
