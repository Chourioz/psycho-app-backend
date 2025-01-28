import { Request, Response } from "express";
import { AppointmentService } from "../services/appointmentService";
import { z } from "zod";
import { UserRole, PrismaClient } from "@prisma/client";
import { generateStreamToken } from "../utils/streamToken";

const appointmentService = new AppointmentService();
const prisma = new PrismaClient();

const createAppointmentSchema = z.object({
  specialistId: z.string(),
  startTime: z.string().transform((str) => new Date(str)),
  endTime: z.string().transform((str) => new Date(str)),
});

export class AppointmentController {
  async create(req: Request, res: Response) {
    try {
      const { specialistId, startTime, endTime } =
        createAppointmentSchema.parse(req.body);
      const userId = req.user!.userId;

      const appointment = await appointmentService.createAppointment({
        userId,
        specialistId,
        startTime,
        endTime,
      });

      res.status(201).json(appointment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: error.errors });
      } else {
        console.error("Failed to create appointment:", error);
        res.status(500).json({ error: "Failed to create appointment" });
      }
    }
  }

  async getUserAppointments(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const appointments = await appointmentService.getUserAppointments(userId);
      res.json(appointments);
    } catch (error) {
      console.error("Failed to fetch appointments:", error);
      res.status(500).json({ error: "Failed to fetch appointments" });
    }
  }

  async getSpecialistTodayAppointments(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { id: true, role: true, specialist: true },
      });

      if (!user || !user.specialist || user.role !== UserRole.SPECIALIST) {
        return res.status(403).json({
          error: "Access denied. Only specialists can access this endpoint.",
        });
      }
      console.log("user", JSON.stringify(user, null, 4));
      const appointments =
        await appointmentService.getSpecialistTodayAppointments(
          user.specialist.id
        );
      return res.status(200).json(appointments);
    } catch (error) {
      console.error("Error fetching specialist's today appointments:", error);
      return res
        .status(500)
        .json({ error: "Failed to fetch today's appointments" });
    }
  }

  async startCall(req: Request, res: Response) {
    try {
      const { appointmentId } = req.params;
      const userInformation = req.user!;
      const callData = await appointmentService.startCall(
        appointmentId,
        userInformation
      );
      res.json(callData);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        console.error("Failed to start call:", error);
        res.status(500).json({ error: "Failed to start call" });
      }
    }
  }

  async endCall(req: Request, res: Response) {
    try {
      const { appointmentId } = req.params;
      const appointment = await appointmentService.endCall(appointmentId);
      res.json(appointment);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        console.error("Failed to end call:", error);
        res.status(500).json({ error: "Failed to end call" });
      }
    }
  }

  async cancel(req: Request, res: Response) {
    try {
      const { appointmentId } = req.params;
      const appointment = await appointmentService.cancelAppointment(
        appointmentId
      );
      res.json(appointment);
    } catch (error) {
      console.error("Failed to cancel appointment:", error);
      res.status(500).json({ error: "Failed to cancel appointment" });
    }
  }

  async getCallInfo(req: Request, res: Response) {
    try {
      const { appointmentId } = req.params;
      console.log("appointmentId", req.user);
      const { userId, role, specialistId } = req.user!;

      const appointment = await appointmentService.getAppointment(
        appointmentId
      );
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }

      // Verify user is a participant
      console.log("userId", {
        userId,
        appointmentUserId: appointment.userId,
        appointmentSpecialistId: appointment.specialistId,
      });
      if (
        (role === UserRole.SPECIALIST &&
          specialistId !== appointment.specialistId) ||
        (role === UserRole.USER && userId !== appointment.userId)
      ) {
        return res
          .status(403)
          .json({ error: "User is not a participant in this appointment" });
      }

      // If call is not in progress, return null
      if (appointment.status !== "IN_PROGRESS") {
        return res
          .status(200)
          .json({
            callId: appointment.callId,
            appointmentStatus: appointment.status,
          });
      }

      // Generate token for the user
      const isSpecialist = specialistId === appointment.specialistId;
      const user = isSpecialist
        ? appointment.specialist.user
        : appointment.user;
      const token = await generateStreamToken(
        userId,
        `${user.firstName} ${user.lastName}`,
        user.profileImage || undefined
      );

      if (!appointment.callId) {
        return res.status(404).json({ error: "Call ID not found" });
      }

      return res.json({
        callId: appointment.callId,
        token,
        appointmentStatus: appointment.status,
      });
    } catch (error) {
      console.error("Error getting call info:", error);
      return res.status(500).json({ error: "Failed to get call information" });
    }
  }
}
