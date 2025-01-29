import { User, UserRole, Specialist } from '@prisma/client';
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.nativeEnum(UserRole)
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  role: z.nativeEnum(UserRole),
  speciality: z.string().optional(),
  license: z.string().optional()
}).refine((data) => {
  if (data.role === UserRole.SPECIALIST) {
    return data.speciality && data.license;
  }
  return true;
}, {
  message: 'Specialists must provide speciality and license',
  path: ['role']
});

export interface LoginInput {
  email: string;
  password: string;
  role: UserRole;
}

export interface RegisterInput extends LoginInput {
  firstName: string;
  lastName: string;
  speciality?: string;
  license?: string;
}

export interface AuthResponse {
  user: Omit<User, 'password'> & {
    specialist?: Specialist | null;
  };
  accessToken: string;
} 