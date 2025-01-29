import { UserRole, PrismaClient, User, Specialist } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { LoginInput, RegisterInput, AuthResponse } from "@/types/auth";
import { AppError } from "@/utils/AppError";
import { prisma } from "@/lib/prisma";

type UserWithSpecialist = User & {
  specialist: Specialist | null;
};

interface TokenData {
  userId: string;
  role: UserRole;
  specialistId?: string;
}

export class AuthService {
  private readonly JWT_SECRET: string;
  private readonly JWT_EXPIRES_IN: string;

  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || "your-default-secret";
    this.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "30d";
  }

  generateToken(payload: { userId: string; role: UserRole; specialistId?: string }) {
    return jwt.sign(
      {
        userId: payload.userId,
        role: payload.role,
        specialistId: payload.specialistId
      },
      process.env.JWT_SECRET!,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
      }
    );
  }

  async login({ email, password, role }: LoginInput): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { specialist: true }
    });

    if (!user) {
      throw AppError.Unauthorized('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw AppError.Unauthorized('Invalid credentials');
    }

    if (role !== user.role) {
      throw AppError.Unauthorized('Invalid role for this user');
    }

    if (user.role === UserRole.SPECIALIST && (!user.specialist || !user.specialist.isVerified)) {
      throw AppError.Forbidden('Specialist account not verified');
    }

    const { password: _, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      accessToken: this.generateToken({
        userId: user.id,
        role: user.role,
        specialistId: user.specialist?.id
      })
    };
  }

  async register(input: RegisterInput): Promise<AuthResponse> {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email }
    });

    if (existingUser) {
      throw AppError.Conflict('User already exists');
    }

    const hashedPassword = await bcrypt.hash(input.password, 12);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        password: hashedPassword,
        firstName: input.firstName,
        lastName: input.lastName,
        role: input.role,
        specialist: input.role === UserRole.SPECIALIST ? {
          create: {
            speciality: input.speciality!,
            license: input.license!,
            isVerified: false
          }
        } : undefined
      },
      include: {
        specialist: true
      }
    });

    const { password: _, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      accessToken: this.generateToken({
        userId: user.id,
        role: user.role,
        specialistId: user.specialist?.id
      })
    };
  }

  async validateToken(token: string): Promise<TokenData> {
    try {
      return jwt.verify(token, this.JWT_SECRET) as TokenData;
    } catch (error) {
      throw AppError.Unauthorized('Invalid token');
    }
  }
}

export const authService = new AuthService();
