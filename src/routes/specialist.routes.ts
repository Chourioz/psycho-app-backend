import { Router, Response, RequestHandler } from 'express';
import { SpecialistController } from '../controllers/specialistController';
import { authenticateJWT } from '../middleware/auth';
import { AppointmentService } from '../services/appointmentService';
import { AuthenticatedRequest } from '../types/auth';

const router = Router();
const specialistController = new SpecialistController();
const appointmentService = new AppointmentService();

// Apply authentication middleware to all routes
router.use(authenticateJWT);

// Get specialist dashboard stats (specific route first)
router.get('/stats', (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const specialistId = req.user.specialistId;
    if (!specialistId) {
      return res.status(403).json({ error: 'Not authorized as specialist' });
    }

    const stats = await appointmentService.getSpecialistStats(specialistId);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching specialist stats:', error);
    res.status(500).json({ error: 'Failed to fetch specialist statistics' });
  }
}) as RequestHandler);

// Get specialist metrics for a date range (specific route)
router.get('/metrics', (async (req: AuthenticatedRequest, res: Response) => {
  try {
    const specialistId = req.user.specialistId;
    if (!specialistId) {
      return res.status(403).json({ error: 'Not authorized as specialist' });
    }

    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date();
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

    const metrics = await appointmentService.getSpecialistMetrics(specialistId, startDate, endDate);
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching specialist metrics:', error);
    res.status(500).json({ error: 'Failed to fetch specialist metrics' });
  }
}) as RequestHandler);

// Generic routes last
router.get('/', specialistController.getAll.bind(specialistController));
router.get('/:id', specialistController.getById.bind(specialistController));

export default router; 