import { PrismaClient } from '@prisma/client';
import { AppError } from '../utils/AppError';

const prisma = new PrismaClient();

export class QueueService {
  async addToQueue(userId: string, specialistId: string): Promise<{ position: number }> {
    try {
      // Check if user is already in queue for this specialist
      const existingQueue = await prisma.instantAppointmentQueue.findUnique({
        where: {
          userId_specialistId: {
            userId,
            specialistId,
          },
        },
      });

      if (existingQueue) {
        return { position: existingQueue.position };
      }

      // Get current queue length for this specialist
      const queueLength = await prisma.instantAppointmentQueue.count({
        where: {
          specialistId,
          status: 'WAITING',
        },
      });

      // Add user to queue
      const queueEntry = await prisma.instantAppointmentQueue.create({
        data: {
          userId,
          specialistId,
          position: queueLength + 1,
          status: 'WAITING',
        },
      });

      return { position: queueEntry.position };
    } catch (error) {
      console.error('Error adding to queue:', error);
      throw new AppError(500, 'Failed to add to queue');
    }
  }

  async removeFromQueue(userId: string, specialistId: string): Promise<void> {
    try {
      await prisma.instantAppointmentQueue.delete({
        where: {
          userId_specialistId: {
            userId,
            specialistId,
          },
        },
      });

      // Reorder remaining queue positions
      const remainingQueue = await prisma.instantAppointmentQueue.findMany({
        where: {
          specialistId,
          status: 'WAITING',
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      // Update positions
      await Promise.all(
        remainingQueue.map((entry, index) =>
          prisma.instantAppointmentQueue.update({
            where: { id: entry.id },
            data: { position: index + 1 },
          })
        )
      );
    } catch (error) {
      console.error('Error removing from queue:', error);
      throw new AppError(500, 'Failed to remove from queue');
    }
  }

  async getQueuePosition(userId: string, specialistId: string): Promise<number | null> {
    try {
      const queueEntry = await prisma.instantAppointmentQueue.findUnique({
        where: {
          userId_specialistId: {
            userId,
            specialistId,
          },
        },
      });

      return queueEntry?.position || null;
    } catch (error) {
      console.error('Error getting queue position:', error);
      throw new AppError(500, 'Failed to get queue position');
    }
  }

  async getSpecialistQueue(specialistId: string) {
    try {
      return prisma.instantAppointmentQueue.findMany({
        where: {
          specialistId,
          status: 'WAITING',
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profileImage: true,
            },
          },
        },
        orderBy: {
          position: 'asc',
        },
      });
    } catch (error) {
      console.error('Error getting specialist queue:', error);
      throw new AppError(500, 'Failed to get specialist queue');
    }
  }

  async processNextInQueue(specialistId: string) {
    try {
      const nextInQueue = await prisma.instantAppointmentQueue.findFirst({
        where: {
          specialistId,
          status: 'WAITING',
        },
        orderBy: {
          position: 'asc',
        },
      });

      if (!nextInQueue) {
        return null;
      }

      // Update status to processing
      await prisma.instantAppointmentQueue.update({
        where: { id: nextInQueue.id },
        data: { status: 'PROCESSING' },
      });

      return nextInQueue;
    } catch (error) {
      console.error('Error processing next in queue:', error);
      throw new AppError(500, 'Failed to process next in queue');
    }
  }

  async getEstimatedWaitTime(position: number): Promise<number> {
    // Assuming average appointment duration is 15 minutes
    const AVERAGE_APPOINTMENT_DURATION = 15;
    return position * AVERAGE_APPOINTMENT_DURATION;
  }
} 