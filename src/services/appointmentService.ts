import { Prisma, PrismaClient, AppointmentStatus, CommunicationType } from '@prisma/client';
import { AppError } from '../utils/AppError';

const prisma = new PrismaClient();

interface CreateAppointmentData {
  userId: string;
  specialistId: string;
  startTime: Date;
  endTime: Date;
  communicationType: CommunicationType;
  phoneNumber?: string;
  notes?: string;
  isInstant?: boolean;
}

interface UpdateAppointmentData {
  status?: AppointmentStatus;
  notes?: string;
  callToken?: string;
}

interface SpecialistStats {
  totalAppointments: number;
  upcomingAppointments: number;
  completedAppointments: number;
  todayAppointments: number;
  cancelledAppointments: number;
  appointmentsByType: {
    [key in CommunicationType]?: number;
  };
  recentAppointments: AppointmentWithUsers[];
}

interface SpecialistMetrics {
  appointmentsByStatus: {
    [key in AppointmentStatus]?: number;
  };
  appointmentsByType: {
    [key in CommunicationType]?: number;
  };
  totalAppointments: number;
}

const appointmentInclude = {
  user: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      profileImage: true,
    },
  },
  specialist: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      profileImage: true,
    },
  },
} as const;

type AppointmentWithUsers = Prisma.AppointmentGetPayload<{
  include: typeof appointmentInclude;
}>;

export class AppointmentService {
  async createAppointment(data: CreateAppointmentData): Promise<AppointmentWithUsers> {
    try {
      console.log("DATA ===>", JSON.stringify(data, null, 4));
      // First verify that the specialist exists
      const specialist = await prisma.specialist.findUnique({
        where: {
          id: data.specialistId,
        }
      });

      console.log("SPECIALIST QUERY RESPONSE ===>", JSON.stringify(specialist, null, 4));

      if (!specialist) {
        throw new AppError(404, 'Specialist not found');
      }

      // Verify that the user exists
      const user = await prisma.user.findUnique({
        where: {
          id: data.userId,
        },
      });

      if (!user) {
        throw new AppError(404, 'User not found');
      }

      // Create the appointment using the specialist's user ID
      const appointment = await prisma.appointment.create({
        data: {
          userId: data.userId,
          specialistId: specialist.userId,
          startTime: data.startTime,
          endTime: data.endTime,
          communicationType: data.communicationType,
          phoneNumber: data.phoneNumber,
          notes: data.notes,
          status: AppointmentStatus.SCHEDULED,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              profileImage: true,
            }
          },
          specialist: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              profileImage: true,
            }
          }
        }
      });

      return appointment;
    } catch (error) {
      console.error('Error creating appointment:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(500, 'Failed to create appointment');
    }
  }

  async getAppointment(id: string): Promise<AppointmentWithUsers | null> {
    try {
      const appointment = await prisma.appointment.findUnique({
        where: { id },
        include: appointmentInclude,
      });

      if (!appointment) {
        throw new AppError(404, 'Appointment not found');
      }

      return appointment;
    } catch (error) {
      console.error('Error fetching appointment:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(500, 'Failed to fetch appointment');
    }
  }

  async getUserAppointments(userId: string): Promise<AppointmentWithUsers[]> {
    try {
      return prisma.appointment.findMany({
        where: { userId },
        include: appointmentInclude,
        orderBy: { startTime: 'desc' },
      });
    } catch (error) {
      console.error('Error fetching user appointments:', error);
      throw new AppError(500, 'Failed to fetch user appointments');
    }
  }

  async getSpecialistAppointments(specialistId: string): Promise<AppointmentWithUsers[]> {
    try {
      // Get the specialist's user ID
      const specialist = await prisma.specialist.findUnique({
        where: { id: specialistId },
      });

      if (!specialist) {
        throw new AppError(404, 'Specialist not found');
      }

      return prisma.appointment.findMany({
        where: { specialistId: specialist.userId },
        include: appointmentInclude,
        orderBy: { startTime: 'desc' },
      });
    } catch (error) {
      console.error('Error fetching specialist appointments:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(500, 'Failed to fetch specialist appointments');
    }
  }

  async getSpecialistTodayAppointments(specialistId: string): Promise<AppointmentWithUsers[]> {
    try {
      // Get the specialist's user ID
      const specialist = await prisma.specialist.findUnique({
        where: { id: specialistId },
      });

      if (!specialist) {
        throw new AppError(404, 'Specialist not found');
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      return prisma.appointment.findMany({
        where: {
          specialistId: specialist.userId,
          startTime: {
            gte: today,
            lt: tomorrow,
          },
        },
        include: appointmentInclude,
        orderBy: { startTime: 'asc' },
      });
    } catch (error) {
      console.error('Error fetching specialist today appointments:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(500, 'Failed to fetch today\'s appointments');
    }
  }

  async updateAppointment(id: string, data: UpdateAppointmentData): Promise<AppointmentWithUsers> {
    try {
      const appointment = await prisma.appointment.update({
        where: { id },
        data,
        include: appointmentInclude,
      });
      return appointment;
    } catch (error) {
      console.error('Error updating appointment:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(500, 'Failed to update appointment');
    }
  }

  async getSpecialistStats(specialistId: string): Promise<SpecialistStats> {
    try {
      // Get the specialist's user ID
      const specialist = await prisma.specialist.findUnique({
        where: { id: specialistId },
      });

      if (!specialist) {
        throw new AppError(404, 'Specialist not found');
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Get counts for each communication type
      const [videoCalls, phoneCalls, liveChats] = await Promise.all([
        prisma.appointment.count({
          where: {
            specialistId: specialist.userId,
            communicationType: CommunicationType.VIDEO_CALL,
          },
        }),
        prisma.appointment.count({
          where: {
            specialistId: specialist.userId,
            communicationType: CommunicationType.PHONE_CALL,
          },
        }),
        prisma.appointment.count({
          where: {
            specialistId: specialist.userId,
            communicationType: CommunicationType.LIVE_CHAT,
          },
        }),
      ]);

      const appointmentsByTypeMap: { [key in CommunicationType]: number } = {
        [CommunicationType.VIDEO_CALL]: videoCalls,
        [CommunicationType.PHONE_CALL]: phoneCalls,
        [CommunicationType.LIVE_CHAT]: liveChats,
      };

      const [
        totalAppointments,
        upcomingAppointments,
        completedAppointments,
        todayAppointments,
        cancelledAppointments,
        recentAppointments,
      ] = await Promise.all([
        // Total appointments
        prisma.appointment.count({
          where: { specialistId: specialist.userId },
        }),
        // Upcoming appointments
        prisma.appointment.count({
          where: {
            specialistId: specialist.userId,
            startTime: { gte: new Date() },
            status: AppointmentStatus.SCHEDULED,
          },
        }),
        // Completed appointments
        prisma.appointment.count({
          where: {
            specialistId: specialist.userId,
            status: AppointmentStatus.COMPLETED,
          },
        }),
        // Today's appointments
        prisma.appointment.count({
          where: {
            specialistId: specialist.userId,
            startTime: {
              gte: today,
              lt: tomorrow,
            },
          },
        }),
        // Cancelled appointments
        prisma.appointment.count({
          where: {
            specialistId: specialist.userId,
            status: AppointmentStatus.CANCELLED,
          },
        }),
        // Recent appointments
        prisma.appointment.findMany({
          where: { specialistId: specialist.userId },
          orderBy: { startTime: 'desc' },
          take: 5,
          include: appointmentInclude,
        }),
      ]);

      return {
        totalAppointments,
        upcomingAppointments,
        completedAppointments,
        todayAppointments,
        cancelledAppointments,
        appointmentsByType: appointmentsByTypeMap,
        recentAppointments,
      };
    } catch (error) {
      console.error('Error fetching specialist stats:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(500, 'Failed to fetch specialist statistics');
    }
  }

  async getSpecialistMetrics(
    specialistId: string,
    startDate: Date,
    endDate: Date
  ): Promise<SpecialistMetrics> {
    try {
      // Get the specialist's user ID
      const specialist = await prisma.specialist.findUnique({
        where: { id: specialistId },
      });

      if (!specialist) {
        throw new AppError(404, 'Specialist not found');
      }

      // Get counts for each status
      const [scheduled, inProgress, completed, cancelled, noShow] = await Promise.all([
        prisma.appointment.count({
          where: {
            specialistId: specialist.userId,
            status: AppointmentStatus.SCHEDULED,
            startTime: {
              gte: startDate,
              lte: endDate,
            },
          },
        }),
        prisma.appointment.count({
          where: {
            specialistId: specialist.userId,
            status: AppointmentStatus.IN_PROGRESS,
            startTime: {
              gte: startDate,
              lte: endDate,
            },
          },
        }),
        prisma.appointment.count({
          where: {
            specialistId: specialist.userId,
            status: AppointmentStatus.COMPLETED,
            startTime: {
              gte: startDate,
              lte: endDate,
            },
          },
        }),
        prisma.appointment.count({
          where: {
            specialistId: specialist.userId,
            status: AppointmentStatus.CANCELLED,
            startTime: {
              gte: startDate,
              lte: endDate,
            },
          },
        }),
        prisma.appointment.count({
          where: {
            specialistId: specialist.userId,
            status: AppointmentStatus.NO_SHOW,
            startTime: {
              gte: startDate,
              lte: endDate,
            },
          },
        }),
      ]);

      // Get counts for each communication type
      const [videoCalls, phoneCalls, liveChats] = await Promise.all([
        prisma.appointment.count({
          where: {
            specialistId: specialist.userId,
            communicationType: CommunicationType.VIDEO_CALL,
            startTime: {
              gte: startDate,
              lte: endDate,
            },
          },
        }),
        prisma.appointment.count({
          where: {
            specialistId: specialist.userId,
            communicationType: CommunicationType.PHONE_CALL,
            startTime: {
              gte: startDate,
              lte: endDate,
            },
          },
        }),
        prisma.appointment.count({
          where: {
            specialistId: specialist.userId,
            communicationType: CommunicationType.LIVE_CHAT,
            startTime: {
              gte: startDate,
              lte: endDate,
            },
          },
        }),
      ]);

      const appointmentsByStatusMap: { [key in AppointmentStatus]: number } = {
        [AppointmentStatus.SCHEDULED]: scheduled,
        [AppointmentStatus.IN_PROGRESS]: inProgress,
        [AppointmentStatus.COMPLETED]: completed,
        [AppointmentStatus.CANCELLED]: cancelled,
        [AppointmentStatus.NO_SHOW]: noShow,
      };

      const appointmentsByTypeMap: { [key in CommunicationType]: number } = {
        [CommunicationType.VIDEO_CALL]: videoCalls,
        [CommunicationType.PHONE_CALL]: phoneCalls,
        [CommunicationType.LIVE_CHAT]: liveChats,
      };

      const totalAppointments = scheduled + inProgress + completed + cancelled + noShow;

      return {
        appointmentsByStatus: appointmentsByStatusMap,
        appointmentsByType: appointmentsByTypeMap,
        totalAppointments,
      };
    } catch (error) {
      console.error('Error fetching specialist metrics:', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(500, 'Failed to fetch specialist metrics');
    }
  }
}
