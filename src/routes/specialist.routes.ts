import { Router } from 'express';
import { SpecialistController } from '../controllers/specialistController';
import { authenticateJWT } from '../middleware/auth';

const router = Router();
const specialistController = new SpecialistController();

// Apply authentication middleware to all routes
router.use(authenticateJWT);

// Specialist routes
router.get('/', specialistController.getAll.bind(specialistController));
router.get('/:id', specialistController.getById.bind(specialistController));

export default router; 