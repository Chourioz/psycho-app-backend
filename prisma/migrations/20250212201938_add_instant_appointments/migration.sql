-- CreateEnum
CREATE TYPE "AppointmentType" AS ENUM ('SCHEDULED', 'INSTANT');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "queuePosition" INTEGER,
ADD COLUMN     "type" "AppointmentType" NOT NULL DEFAULT 'SCHEDULED';

-- CreateTable
CREATE TABLE "InstantAppointmentQueue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "specialistId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstantAppointmentQueue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstantAppointmentQueue_specialistId_idx" ON "InstantAppointmentQueue"("specialistId");

-- CreateIndex
CREATE UNIQUE INDEX "InstantAppointmentQueue_userId_specialistId_key" ON "InstantAppointmentQueue"("userId", "specialistId");

-- AddForeignKey
ALTER TABLE "InstantAppointmentQueue" ADD CONSTRAINT "InstantAppointmentQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstantAppointmentQueue" ADD CONSTRAINT "InstantAppointmentQueue_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
