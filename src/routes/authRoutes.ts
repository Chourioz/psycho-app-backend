import { Router } from 'express';
import { login, register, validateSession } from '../controllers/authController';

const router = Router();

// Rutas públicas de autenticación
router.post('/login', login);
router.post('/register', register);
router.get('/validate', validateSession);

export default router; 