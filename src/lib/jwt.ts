import jwt from 'jsonwebtoken';
import { AuthUser } from '../types/auth';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const JWT_SECRET = process.env.JWT_SECRET;

export function generateToken(user: AuthUser): string {
  return jwt.sign(user, JWT_SECRET);
}

export function verifyToken(token: string): AuthUser {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

export function decodeToken(token: string): AuthUser | null {
  try {
    return jwt.decode(token) as AuthUser;
  } catch (error) {
    return null;
  }
} 