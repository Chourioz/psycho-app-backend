import { Request, Response } from "express";
import { AppointmentService } from "../services/appointmentService";
import { z } from "zod";
import {
  UserRole,
  PrismaClient,
  CommunicationType,
  AppointmentStatus,
} from "@prisma/client";
import { generateStreamToken } from "../utils/streamToken";
import { AppError } from "../utils/AppError";
import { AuthenticatedRequest } from "../types/auth";

const appointmentService = new AppointmentService();
const prisma = new PrismaClient();

const createAppointmentSchema = z.object({
  specialistId: z.string(),
  startTime: z.string().transform((str) => new Date(str)),
  endTime: z.string().transform((str) => new Date(str)),
  communicationType: z.nativeEnum(CommunicationType),
  phoneNumber: z.string().optional(),
});

export class AppointmentController {
  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const {
        specialistId,
        startTime,
        endTime,
        communicationType,
        phoneNumber,
      } = createAppointmentSchema.parse(req.body);
      const userId = req.user.userId;

      const appointment = await appointmentService.createAppointment({
        userId,
        specialistId,
        startTime,
        endTime,
        communicationType,
        phoneNumber,
      });

      res.status(201).json(appointment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        console.error("Failed to create appointment:", error);
        res.status(500).json({ error: "Failed to create appointment" });
      }
    }
  }

  async getUserAppointments(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user.userId;
      const appointments = await appointmentService.getUserAppointments(userId);
      res.json(appointments);
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        console.error("Failed to fetch appointments:", error);
        res.status(500).json({ error: "Failed to fetch appointments" });
      }
    }
  }

  async getSpecialistTodayAppointments(
    req: AuthenticatedRequest,
    res: Response
  ) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        include: { specialist: true },
      });

      if (!user || !user.specialist || user.role !== UserRole.SPECIALIST) {
        return res.status(403).json({
          error: "Access denied. Only specialists can access this endpoint.",
        });
      }

      const appointments =
        await appointmentService.getSpecialistTodayAppointments(
          user.specialist.id
        );
      return res.status(200).json(appointments);
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        console.error("Error fetching specialist's today appointments:", error);
        return res
          .status(500)
          .json({ error: "Failed to fetch today's appointments" });
      }
    }
  }

  async startVideoCall(req: AuthenticatedRequest, res: Response) {
    try {
      const { appointmentId } = req.params;
      const appointment = await appointmentService.getAppointment(
        appointmentId
      );

      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      // Verify user is a participant
      if (
        appointment.userId !== req.user.userId &&
        appointment.specialistId !== req.user.userId
      ) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Only allow starting video calls
      if (appointment.communicationType !== CommunicationType.VIDEO_CALL) {
        return res
          .status(400)
          .json({ error: "This appointment is not a video call" });
      }

      // Update appointment status to IN_PROGRESS
      const updatedAppointment = await appointmentService.updateAppointment(
        appointmentId,
        {
          status: AppointmentStatus.IN_PROGRESS,
        }
      );

      // Get user information for token
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: {
          firstName: true,
          lastName: true,
          profileImage: true,
        },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Generate token for the user
      const token = await generateStreamToken(
        req.user.userId,
        `${user.firstName} ${user.lastName}`,
        user.profileImage || undefined
      );

      res.json({
        appointmentId,
        token,
        appointmentStatus: updatedAppointment.status,
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        console.error("Failed to start video call:", error);
        res.status(500).json({ error: "Failed to start video call" });
      }
    }
  }

  async endVideoCall(req: AuthenticatedRequest, res: Response) {
    try {
      const { appointmentId } = req.params;
      const appointment = await appointmentService.getAppointment(
        appointmentId
      );

      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      // Only allow specialist to end call
      if (appointment.specialistId !== req.user.userId) {
        return res
          .status(403)
          .json({ error: "Only specialists can end calls" });
      }

      const updatedAppointment = await appointmentService.updateAppointment(
        appointmentId,
        {
          status: AppointmentStatus.COMPLETED,
        }
      );

      res.json(updatedAppointment);
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        console.error("Failed to end video call:", error);
        res.status(500).json({ error: "Failed to end video call" });
      }
    }
  }

  async cancelAppointment(req: AuthenticatedRequest, res: Response) {
    try {
      const { appointmentId } = req.params;
      const appointment = await appointmentService.getAppointment(
        appointmentId
      );

      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      // Allow both user and specialist to cancel
      if (
        appointment.userId !== req.user.userId &&
        appointment.specialistId !== req.user.userId
      ) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const updatedAppointment = await appointmentService.updateAppointment(
        appointmentId,
        {
          status: AppointmentStatus.CANCELLED,
        }
      );

      res.json(updatedAppointment);
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        console.error("Failed to cancel appointment:", error);
        res.status(500).json({ error: "Failed to cancel appointment" });
      }
    }
  }

  async getCallInfo(req: AuthenticatedRequest, res: Response) {
    try {
      const { appointmentId } = req.params;
      const appointment = await appointmentService.getAppointment(
        appointmentId
      );

      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      // Verify user is a participant
      if (
        appointment.userId !== req.user.userId &&
        appointment.specialistId !== req.user.userId
      ) {
        return res
          .status(403)
          .json({ error: "User is not a participant in this appointment" });
      }

      // If call is not in progress, return current status
      if (appointment.status !== AppointmentStatus.IN_PROGRESS) {
        return res.status(200).json({
          appointmentId,
          appointmentStatus: appointment.status,
        });
      }

      // Get user information for token
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: {
          firstName: true,
          lastName: true,
          profileImage: true,
        },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Generate token for the user
      const token = await generateStreamToken(
        req.user.userId,
        `${user.firstName} ${user.lastName}`,
        user.profileImage || undefined
      );

      return res.json({
        appointmentId,
        token,
        appointmentStatus: appointment.status,
      });
    } catch (error) {
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        console.error("Error getting call info:", error);
        return res
          .status(500)
          .json({ error: "Failed to get call information" });
      }
    }
  }
}
