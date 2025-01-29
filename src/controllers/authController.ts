import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import { loginSchema, registerSchema } from '../types/auth';
import { AppError } from '../utils/AppError';
import { z } from 'zod';

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    console.debug('Login request received:', req.body);

    // Validate request body
    const result = loginSchema.safeParse(req.body);
    
    if (!result.success) {
      console.log('Login validation failed:', result.error.errors);
      const errorMessage = result.error.errors.map((err: z.ZodError['errors'][0]) => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      throw AppError.ValidationError(errorMessage);
    }

    console.log('Login validation successful, attempting login');
    const { email, password, role } = result.data;
    
    const authResult = await authService.login({ email, password, role });
    console.log('Login successful for user:', authResult.user.id);

    return res.json({
      status: 'success',
      data: authResult
    });
  } catch (error) {
    console.error('Login error:', error);
    next(error);
  }
};

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    console.debug('Registration request received:', req.body);

    // Validate request body
    const result = registerSchema.safeParse(req.body);
    
    if (!result.success) {
      console.log('Registration validation failed:', result.error.errors);
      const errorMessage = result.error.errors.map((err: z.ZodError['errors'][0]) => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      throw AppError.ValidationError(errorMessage);
    }

    console.log('Registration validation successful, attempting registration');
    const registrationResult = await authService.register(result.data);
    console.log('Registration successful for user:', registrationResult.user.id);

    return res.status(201).json({
      status: 'success',
      data: registrationResult
    });
  } catch (error) {
    console.error('Registration error:', error);
    next(error);
  }
};

export const validateSession = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw AppError.Unauthorized('No token provided');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw AppError.Unauthorized('Invalid token format');
    }

    const result = await authService.validateToken(token);
    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
}; 