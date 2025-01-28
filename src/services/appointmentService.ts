import {
  PrismaClient,
  Prisma,
  AppointmentStatus,
  UserRole,
} from "@prisma/client";
import { StreamClient } from "@stream-io/node-sdk";
import { generateStreamToken } from "../utils/streamToken";

const prisma = new PrismaClient();

interface CreateAppointmentData {
  userId: string;
  specialistId: string;
  startTime: Date;
  endTime: Date;
}

interface UpdateAppointmentData {
  status?: AppointmentStatus;
  callId?: string | null;
}

const appointmentInclude = {
  user: true,
  specialist: {
    include: {
      user: true,
    },
  },
} as const;

type AppointmentWithUsers = Prisma.AppointmentGetPayload<{
  include: typeof appointmentInclude;
}>;

export class AppointmentService {
  private streamClient: StreamClient;

  constructor() {
    const apiKey = process.env.STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;

    if (!apiKey || !apiSecret) {
      throw new Error("Stream credentials not configured");
    }

    this.streamClient = new StreamClient(apiKey, apiSecret);
  }

  async createAppointment(
    data: CreateAppointmentData
  ): Promise<AppointmentWithUsers> {
    const callId = `appointment-${Date.now()}`;

    // First create the appointment in our database
    const appointment = await prisma.appointment.create({
      data: {
        user: {
          connect: { id: data.userId },
        },
        specialist: {
          connect: { id: data.specialistId },
        },
        startTime: data.startTime,
        endTime: data.endTime,
        status: AppointmentStatus.SCHEDULED,
        callId,
      },
      include: appointmentInclude,
    });

    try {
      // Ensure both users exist in Stream
      const users = await this.streamClient.upsertUsers([
        {
          id: appointment.userId,
          role: "user",
          name: `${appointment.user.firstName} ${appointment.user.lastName}`,
          image: appointment.user.profileImage || undefined,
        },
        {
          id: appointment.specialistId,
          role: "admin",
          name: `${appointment.specialist.user.firstName} ${appointment.specialist.user.lastName}`,
          image: appointment.specialist.user.profileImage || undefined,
        },
      ]);
      console.log("Users upserted:", JSON.stringify(users, null, 4));
      // Create the call in Stream
      const call = this.streamClient.video.call("default", callId);
      console.log("Call created:", JSON.stringify(call, null, 4));
      await call.getOrCreate({
        data: {
          starts_at: appointment.startTime,
          created_by_id: appointment.specialistId,
          members: [
            { user_id: appointment.userId, role: "user" },
            { user_id: appointment.specialistId, role: "admin" },
          ],
          custom: {
            appointmentId: appointment.id,
            endTime: appointment.endTime.toISOString(),
          },
        },
      });
      console.log("Call created:", JSON.stringify(call, null, 4));
      return appointment;
    } catch (error) {
      // If Stream call creation fails, delete the appointment
      await prisma.appointment.delete({ where: { id: appointment.id } });
      throw error;
    }
  }

  async getAppointment(id: string): Promise<AppointmentWithUsers | null> {
    return prisma.appointment.findUnique({
      where: { id },
      include: appointmentInclude,
    });
  }

  async getUserAppointments(userId: string): Promise<AppointmentWithUsers[]> {
    try {
      const appointments = await prisma.appointment.findMany({
        where: {
          userId,
          status: {
            not: AppointmentStatus.CANCELLED,
          },
        },
        orderBy: {
          startTime: "asc",
        },
        include: appointmentInclude,
      });

      return appointments;
    } catch (error) {
      console.error("Error fetching user appointments:", error);
      return [];
    }
  }

  async updateAppointment(
    id: string,
    data: UpdateAppointmentData
  ): Promise<AppointmentWithUsers> {
    return prisma.appointment.update({
      where: { id },
      data,
      include: appointmentInclude,
    });
  }

  async cancelAppointment(id: string): Promise<AppointmentWithUsers> {
    return prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CANCELLED },
      include: appointmentInclude,
    });
  }

  async getSpecialistAppointments(
    specialistId: string
  ): Promise<AppointmentWithUsers[]> {
    try {
      const appointments = await prisma.appointment.findMany({
        where: {
          specialistId,
          status: {
            not: AppointmentStatus.CANCELLED,
          },
        },
        orderBy: {
          startTime: "asc",
        },
        include: appointmentInclude,
      });

      return appointments;
    } catch (error) {
      console.error("Error fetching specialist appointments:", error);
      return [];
    }
  }

  async startCall(
    appointmentId: string,
    userInformation: { userId: string; role: string; specialistId?: string }
  ): Promise<{ callId: string; token: string; appointmentStatus: AppointmentStatus }> {
    const { userId, role, specialistId } = userInformation;
    const appointment = await this.getAppointment(appointmentId);
    if (!appointment) {
      throw new Error("Appointment not found");
    }

    const now = new Date();
    // const startWindow = new Date(appointment.startTime.getTime() - 5 * 60000); // 5 minutes before
    // if (now < startWindow) {
    //   throw new Error("Too early to start the call");
    // }

    // if (now > appointment.endTime) {
    //   throw new Error("Appointment has ended");
    // }

    // Verify user is a participant
    if (
      (role === UserRole.SPECIALIST &&
        specialistId !== appointment.specialistId) ||
      (role === UserRole.USER && userId !== appointment.userId)
    ) {
      throw new Error("User is not a participant in this appointment");
    }

    // Generate token for the user
    const isSpecialist = userId === appointment.specialistId;
    const user = isSpecialist ? appointment.specialist.user : appointment.user;
    const token = await generateStreamToken(
      userId,
      `${user.firstName} ${user.lastName}`,
      user.profileImage || undefined
    );

    // Update appointment status
    if (appointment.status === AppointmentStatus.SCHEDULED) {
      await this.updateAppointment(appointmentId, {
        status: AppointmentStatus.IN_PROGRESS,
      });
    }

    if (!appointment.callId) {
      throw new Error("Call ID not found");
    }

    return {
      callId: appointment.callId,
      token,
      appointmentStatus: appointment.status,
    };
  }

  async endCall(appointmentId: string): Promise<AppointmentWithUsers> {
    const appointment = await this.getAppointment(appointmentId);
    if (!appointment) {
      throw new Error("Appointment not found");
    }

    if (appointment.status !== AppointmentStatus.IN_PROGRESS) {
      throw new Error("Call is not in progress");
    }

    // End the Stream call
    if (appointment.callId) {
      try {
        await this.streamClient.video.call("default", appointment.callId).end();
      } catch (error) {
        console.error("Failed to end Stream call:", error);
      }
    }

    return this.updateAppointment(appointmentId, {
      status: AppointmentStatus.COMPLETED,
    });
  }

  async queryUpcomingCalls(userId: string): Promise<AppointmentWithUsers[]> {
    const now = new Date();
    return prisma.appointment.findMany({
      where: {
        OR: [{ userId }, { specialistId: userId }],
        AND: [
          { startTime: { gt: now } },
          { status: AppointmentStatus.SCHEDULED },
        ],
      },
      orderBy: {
        startTime: "asc",
      },
      include: appointmentInclude,
    });
  }

  async getSpecialistTodayAppointments(
    specialistId: string
  ): Promise<AppointmentWithUsers[]> {
    console.log("specialistId", specialistId);
    try {
      const today = new Date();
      const startOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
      const endOfDay = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        23,
        59,
        59
      );
      console.log("startOfDay", startOfDay);
      console.log("endOfDay", endOfDay);
      const appointments = await prisma.appointment.findMany({
        where: {
          specialistId,
          startTime: {
            gte: startOfDay,
            lte: endOfDay,
          },
          status: {
            not: AppointmentStatus.CANCELLED,
          },
        },
        orderBy: {
          startTime: "asc",
        },
        include: appointmentInclude,
      });

      return appointments;
    } catch (error) {
      console.error("Error fetching specialist's today appointments:", error);
      return [];
    }
  }
}
