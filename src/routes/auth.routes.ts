import { Router } from 'express';
import { body } from 'express-validator';
import {
  register,
  login,
  googleAuth,
  googleCallback,
  refreshToken,
} from '../controllers/auth.controller';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

// Registration validation
const registerValidation = [
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('role').isIn(['USER', 'SPECIALIST']).withMessage('Invalid role'),
];

// Login validation
const loginValidation = [
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
];

// Routes
router.post('/register', registerValidation, validateRequest, register);
router.post('/login', loginValidation, validateRequest, login);
router.get('/google', googleAuth);
router.get('/google/callback', googleCallback);
router.post('/refresh-token', refreshToken);

export default router; 