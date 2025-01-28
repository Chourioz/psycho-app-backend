import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { AppError } from '../utils/AppError';
import { userService } from '../services/userService';
import { prisma } from '../lib/prisma';

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_CALLBACK_URL
);

const generateToken = (userId: string, role: string, specialistId?: string) => {
  console.log("generateToken", { userId, role, specialistId });
  return jwt.sign(
    { userId, role, specialistId },
    process.env.JWT_SECRET as string,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password, firstName, lastName, role, speciality, license } = req.body;

    const user = await userService.createUser({
      email,
      password,
      firstName,
      lastName,
      role: role as UserRole,
      speciality,
      license
    });

    // Generate token
    const token = generateToken(user.id, user.role, user?.specialist?.id);

    res.status(201).json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        specialist: true
      }
    });

    if (!user) {
      throw AppError.Unauthorized('Invalid credentials');
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw AppError.Unauthorized('Invalid credentials');
    }

    // Check if specialist is verified
    if (user.role === UserRole.SPECIALIST && (!user.specialist || !user.specialist.isVerified)) {
      throw AppError.Forbidden('Specialist account not verified');
    }

    // Generate token
    const token = generateToken(user.id, user.role, user?.specialist?.id);

    res.json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const googleAuth = (req: Request, res: Response) => {
  const url = googleClient.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  });
  res.redirect(url);
};

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
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: payload.email as string,
          firstName: payload.given_name as string,
          lastName: payload.family_name as string,
          password: await bcrypt.hash(Math.random().toString(36), 12),
          role: 'USER',
        },
      });
    }

    // Generate token
    const token = generateToken(user.id, user.role, user?.specialist?.id);

    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (error) {
    next(error);
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
    ) as { userId: string; role: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      throw new AppError(401, 'Invalid refresh token');
    }

    const newToken = generateToken(user.id, user.role, user?.specialist?.id);

    res.json({
      status: 'success',
      data: { token: newToken },
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError(401, 'Invalid refresh token'));
    } else {
      next(error);
    }
  }
}; 