import { Router, Response, Request, RequestHandler } from 'express';
import { authenticateJWT } from '../middleware/auth';
import { AppointmentService } from '../services/appointmentService';
import { AppointmentStatus, CommunicationType } from '@prisma/client';
import { AuthenticatedRequest } from '../types/auth';
import { AppError } from '../utils/AppError';

const router = Router();
const appointmentService = new AppointmentService();

const handleAsyncRoute = (fn: (req: AuthenticatedRequest, res: Response) => Promise<any>): RequestHandler => {
  return async (req: Request, res: Response) => {
    try {
      await fn(req as AuthenticatedRequest, res);
    } catch (error) {
      console.error('Route error:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
};

// Create appointment
router.post('/', authenticateJWT, handleAsyncRoute(async (req: AuthenticatedRequest, res: Response) => {
  const { specialistId, startTime, endTime, communicationType, phoneNumber } = req.body;
  const userId = req.user.userId;

  // Validate communication type
  if (!Object.values(CommunicationType).includes(communicationType)) {
    return res.status(400).json({ error: 'Invalid communication type' });
  }

  // Validate phone number for phone calls
  if (communicationType === CommunicationType.PHONE_CALL && !phoneNumber) {
    return res.status(400).json({ error: 'Phone number is required for phone calls' });
  }

  const appointment = await appointmentService.createAppointment({
    userId,
    specialistId,
    startTime: new Date(startTime),
    endTime: new Date(endTime),
    communicationType,
    phoneNumber,
  });

  res.json(appointment);
}));

// Get appointment by ID
router.get('/:id', authenticateJWT, handleAsyncRoute(async (req: AuthenticatedRequest, res: Response) => {
  const appointment = await appointmentService.getAppointment(req.params.id);

  if (!appointment) {
    return res.status(404).json({ error: 'Appointment not found' });
  }

  // Check if user has access to this appointment
  if (appointment.userId !== req.user.userId && appointment.specialistId !== req.user.userId) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  res.json(appointment);
}));

// Get user appointments
router.get('/user/appointments', authenticateJWT, handleAsyncRoute(async (req: AuthenticatedRequest, res: Response) => {
  const appointments = await appointmentService.getUserAppointments(req.user.userId);
  res.json(appointments);
}));

// Get specialist appointments
router.get('/specialist/appointments', authenticateJWT, handleAsyncRoute(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user.specialistId) {
    return res.status(403).json({ error: 'Not authorized as specialist' });
  }

  const appointments = await appointmentService.getSpecialistAppointments(req.user.specialistId);
  res.json(appointments);
}));

// Update appointment status
router.patch('/:id/status', authenticateJWT, handleAsyncRoute(async (req: AuthenticatedRequest, res: Response) => {
  const { status } = req.body;
  const appointmentId = req.params.id;

  if (!Object.values(AppointmentStatus).includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const appointment = await appointmentService.getAppointment(appointmentId);

  if (!appointment) {
    return res.status(404).json({ error: 'Appointment not found' });
  }

  // Only allow specialist to update status
  if (appointment.specialistId !== req.user.userId) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const updatedAppointment = await appointmentService.updateAppointment(appointmentId, { status });
  res.json(updatedAppointment);
}));

// Save appointment notes
router.patch('/:id/notes', authenticateJWT, handleAsyncRoute(async (req: AuthenticatedRequest, res: Response) => {
  const { notes } = req.body;
  const appointmentId = req.params.id;

  const appointment = await appointmentService.getAppointment(appointmentId);

  if (!appointment) {
    return res.status(404).json({ error: 'Appointment not found' });
  }

  // Only allow specialist to add notes
  if (appointment.specialistId !== req.user.userId) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const updatedAppointment = await appointmentService.updateAppointment(appointmentId, { notes });
  res.json(updatedAppointment);
}));

export default router; 