import { Router } from 'express';
import authRoutes from './auth.routes';
import { authenticateJWT } from '../middleware/auth';
import appointmentRoutes from './appointment.routes';
import prescriptionRoutes from './prescription.routes';
import progressRoutes from './progress.routes';
import userRoutes from './user.routes';
import specialistRoutes from './specialist.routes';
import messageRoutes from './messages';

const router = Router();

// Public routes
router.use('/auth', authRoutes);

// Protected routes
router.use('/users', authenticateJWT, userRoutes);
router.use('/specialists', authenticateJWT, specialistRoutes);
router.use('/appointments', authenticateJWT, appointmentRoutes);
router.use('/prescriptions', authenticateJWT, prescriptionRoutes);
router.use('/progress', authenticateJWT, progressRoutes);
router.use('/', messageRoutes);

export { router as routes }; 