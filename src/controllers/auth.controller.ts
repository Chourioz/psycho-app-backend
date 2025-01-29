import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { AppError } from '../utils/AppError';
import { prisma } from '../lib/prisma';
import { AuthService } from '../services/authService';
import { User, Specialist, UserRole } from '@prisma/client';
import { catchAsync } from '../utils/catchAsync';
import { LoginInput, RegisterInput } from '../types/auth';

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK_URL
);

interface UserWithSpecialist extends User {
  specialist: Specialist | null;
}

const generateToken = (userId: string, role: UserRole, specialistId?: string): string => {
  const authService = new AuthService();
  return authService.generateToken({ userId, role, specialistId });
};

const authService = new AuthService();

export const register = catchAsync(async (req: Request, res: Response) => {
  const registerData: RegisterInput = req.body;
  const result = await authService.register(registerData);
  res.json(result);
});

export const login = catchAsync(async (req: Request, res: Response) => {
  const loginData: LoginInput = req.body;
  const result = await authService.login(loginData);
  res.json(result);
});

export const googleAuth = catchAsync(async (req: Request, res: Response) => {
  const { token } = req.body;
  
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    if (!payload) {
      throw AppError.Unauthorized('Invalid Google token');
    }
    
    // Handle Google authentication logic here
    // This is a placeholder for the actual implementation
    res.json({ 
      status: 'success',
      message: 'Google authentication successful',
      data: payload 
    });
  } catch (error) {
    if (error instanceof Error) {
      throw AppError.Unauthorized(error.message);
    }
    throw AppError.Unauthorized('Failed to verify Google token');
  }
});

export const googleCallback = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      throw new AppError(400, 'Invalid authorization code');
    }

    // Get tokens
    const { tokens } = await googleClient.getToken(code);
    const ticket = await googleClient.verifyIdToken({
      idToken: tokens.id_token as string,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new AppError(400, 'Invalid Google token');
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: payload.email as string },
      include: { specialist: true }
    }) as UserWithSpecialist | null;

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: payload.email as string,
          firstName: payload.given_name as string,
          lastName: payload.family_name as string,
          password: await bcrypt.hash(Math.random().toString(36), 12),
          role: UserRole.USER,
        },
        include: { specialist: true }
      }) as UserWithSpecialist;
    }

    // Generate token
    const token = generateToken(user.id, user.role, user.specialist?.id);

    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (error) {
    if (error instanceof Error) {
      next(new AppError(500, error.message));
    } else {
      next(new AppError(500, 'An unexpected error occurred'));
    }
  }
};

export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token } = req.body;

    if (!token) {
      throw new AppError(400, 'Refresh token is required');
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as { userId: string; role: UserRole };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { specialist: true }
    }) as UserWithSpecialist | null;

    if (!user) {
      throw new AppError(401, 'Invalid refresh token');
    }

    const newToken = generateToken(user.id, user.role, user.specialist?.id);

    res.json({
      status: 'success',
      data: { token: newToken },
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError(401, 'Invalid refresh token'));
    } else if (error instanceof Error) {
      next(new AppError(500, error.message));
    } else {
      next(new AppError(500, 'An unexpected error occurred'));
    }
  }
};

export const validateToken = catchAsync(async (req: Request, res: Response) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    throw AppError.Unauthorized('No token provided');
  }
  
  const decoded = await authService.validateToken(token);
  res.json(decoded);
}); 