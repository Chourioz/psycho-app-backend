/*
  Warnings:

  - You are about to drop the column `type` on the `Appointment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Appointment" DROP COLUMN "type",
ADD COLUMN     "isInstant" BOOLEAN NOT NULL DEFAULT false;
