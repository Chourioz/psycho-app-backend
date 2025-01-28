import { Router } from 'express';
import { AppointmentController } from '../controllers/appointmentController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();
const appointmentController = new AppointmentController();

// Apply authentication middleware to all routes
router.use(authenticateJWT);

// Appointment CRUD routes
router.post('/', appointmentController.create.bind(appointmentController));
router.get('/user', appointmentController.getUserAppointments.bind(appointmentController));
router.get('/specialist/today', appointmentController.getSpecialistTodayAppointments.bind(appointmentController));

// Call management routes
router.get('/:appointmentId/call', appointmentController.getCallInfo.bind(appointmentController));
router.post('/:appointmentId/start', appointmentController.startCall.bind(appointmentController));
router.post('/:appointmentId/end', appointmentController.endCall.bind(appointmentController));
router.post('/:appointmentId/cancel', appointmentController.cancel.bind(appointmentController));

export default router;