import { Router, Response, RequestHandler } from 'express';
import { AppointmentController } from '../controllers/appointmentController';
import { authenticateJWT } from '../middleware/auth';
import { AuthenticatedRequest } from '../types/auth';

const router = Router();
const appointmentController = new AppointmentController();

// Helper function to wrap controller methods
const asyncHandler = (fn: (req: AuthenticatedRequest, res: Response) => Promise<any>): RequestHandler => {
  return async (req, res, next) => {
    try {
      await fn(req as AuthenticatedRequest, res);
    } catch (error) {
      next(error);
    }
  };
};

// Apply authentication middleware to all routes
router.use(authenticateJWT);

// Instant appointment routes
router.post('/instant/request', asyncHandler(appointmentController.requestInstantAppointment.bind(appointmentController)));
router.get('/instant/queue/:specialistId', asyncHandler(appointmentController.getQueuePosition.bind(appointmentController)));
router.delete('/instant/queue/:specialistId', asyncHandler(appointmentController.cancelQueueRequest.bind(appointmentController)));
router.get('/instant/specialist/queue', asyncHandler(appointmentController.getSpecialistQueue.bind(appointmentController)));
router.post('/instant/specialist/next', asyncHandler(appointmentController.processNextInQueue.bind(appointmentController)));

// Regular appointment routes
router.post('/', asyncHandler(appointmentController.create.bind(appointmentController)));
router.get('/user/appointments', asyncHandler(appointmentController.getUserAppointments.bind(appointmentController)));
router.get('/specialist/today', asyncHandler(appointmentController.getSpecialistTodayAppointments.bind(appointmentController)));

// Call management routes
router.get('/:appointmentId/call-info', asyncHandler(appointmentController.getCallInfo.bind(appointmentController)));
router.post('/:appointmentId/video/start', asyncHandler(appointmentController.startVideoCall.bind(appointmentController)));
router.post('/:appointmentId/video/end', asyncHandler(appointmentController.endVideoCall.bind(appointmentController)));
router.post('/:appointmentId/cancel', asyncHandler(appointmentController.cancelAppointment.bind(appointmentController)));

// Notes and status updates
router.patch('/:appointmentId/notes', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { appointmentId } = req.params;
  const { notes } = req.body;
  const appointment = await appointmentController.getAppointment(appointmentId);

  if (!appointment) {
    return res.status(404).json({ error: 'Appointment not found' });
  }

  // Only allow specialist to add notes
  if (appointment.specialistId !== req.user.userId) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const updatedAppointment = await appointmentController.updateAppointment(appointmentId, { notes });
  res.json(updatedAppointment);
}));

router.patch('/:appointmentId/status', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { appointmentId } = req.params;
  const { status } = req.body;
  const appointment = await appointmentController.getAppointment(appointmentId);

  if (!appointment) {
    return res.status(404).json({ error: 'Appointment not found' });
  }

  // Only allow specialist to update status
  if (appointment.specialistId !== req.user.userId) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const updatedAppointment = await appointmentController.updateAppointment(appointmentId, { status });
  res.json(updatedAppointment);
}));

export default router;