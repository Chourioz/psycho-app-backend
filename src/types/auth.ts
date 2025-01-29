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

export const envSchema = z.object({
  // Application
  PORT: z.number().default(4000),
  NODE_ENV: z.enum(['development', 'production']).default('development'),
  FRONTEND_URL: z.string().url(),

  // Database
  DATABASE_URL: z.string().min(1),

  // Authentication
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // OAuth
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_CALLBACK_URL: z.string().url(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),

  // Email
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.number().default(587),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  FROM_EMAIL: z.string().email(),

  // Stream
  STREAM_API_KEY: z.string().min(1),
  STREAM_API_SECRET: z.string().min(1),

  // Storage
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_REGION: z.string().min(1),
  STORAGE_ACCESS_KEY: z.string().min(1),
  STORAGE_SECRET_KEY: z.string().min(1)
});

export type EnvConfig = z.infer<typeof envSchema>; 