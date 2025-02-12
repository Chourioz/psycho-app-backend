/*
  Warnings:

  - You are about to drop the column `callId` on the `Appointment` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "CommunicationType" AS ENUM ('VIDEO_CALL', 'PHONE_CALL', 'LIVE_CHAT');

-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_specialistId_fkey";

-- DropIndex
DROP INDEX "Appointment_callId_key";

-- DropIndex
DROP INDEX "Appointment_startTime_idx";

-- AlterTable
ALTER TABLE "Appointment" DROP COLUMN "callId",
ADD COLUMN     "callToken" TEXT,
ADD COLUMN     "communicationType" "CommunicationType" NOT NULL DEFAULT 'VIDEO_CALL',
ADD COLUMN     "phoneNumber" TEXT;

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Message_appointmentId_idx" ON "Message"("appointmentId");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
