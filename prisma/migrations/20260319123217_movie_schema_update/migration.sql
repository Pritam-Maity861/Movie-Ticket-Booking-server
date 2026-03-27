/*
  Warnings:

  - You are about to drop the column `genreId` on the `Movie` table. All the data in the column will be lost.
  - You are about to drop the column `languageId` on the `Movie` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "CreditRole" AS ENUM ('ACTOR', 'DIRECTOR', 'PRODUCER');

-- DropForeignKey
ALTER TABLE "Movie" DROP CONSTRAINT "Movie_genreId_fkey";

-- DropForeignKey
ALTER TABLE "Movie" DROP CONSTRAINT "Movie_languageId_fkey";

-- AlterTable
ALTER TABLE "Movie" DROP COLUMN "genreId",
DROP COLUMN "languageId";

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovieCredit" (
    "id" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "role" "CreditRole" NOT NULL,
    "characterName" TEXT,
    "billingOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MovieCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_MovieGenres" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MovieGenres_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_MovieLanguages" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MovieLanguages_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "MovieCredit_movieId_idx" ON "MovieCredit"("movieId");

-- CreateIndex
CREATE INDEX "MovieCredit_personId_idx" ON "MovieCredit"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "MovieCredit_movieId_personId_role_key" ON "MovieCredit"("movieId", "personId", "role");

-- CreateIndex
CREATE INDEX "_MovieGenres_B_index" ON "_MovieGenres"("B");

-- CreateIndex
CREATE INDEX "_MovieLanguages_B_index" ON "_MovieLanguages"("B");

-- AddForeignKey
ALTER TABLE "MovieCredit" ADD CONSTRAINT "MovieCredit_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovieCredit" ADD CONSTRAINT "MovieCredit_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MovieGenres" ADD CONSTRAINT "_MovieGenres_A_fkey" FOREIGN KEY ("A") REFERENCES "Genre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MovieGenres" ADD CONSTRAINT "_MovieGenres_B_fkey" FOREIGN KEY ("B") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MovieLanguages" ADD CONSTRAINT "_MovieLanguages_A_fkey" FOREIGN KEY ("A") REFERENCES "Language"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MovieLanguages" ADD CONSTRAINT "_MovieLanguages_B_fkey" FOREIGN KEY ("B") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
