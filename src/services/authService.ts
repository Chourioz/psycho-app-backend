import { UserRole, PrismaClient, User, Specialist } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { LoginInput, RegisterInput, AuthResponse } from "@/types/auth";
import { AppError } from "@/utils/AppError";
import { prisma } from "@/lib/prisma";

type UserWithSpecialist = User & {
  specialist: Specialist | null;
};

const JWT_SECRET = process.env.JWT_SECRET || "your-default-secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "30d";

class AuthService {
  private generateToken(data: {
    userId: string;
    role: string;
    specialistId?: string;
  }): string {
    console.log("generateToken", { data });
    return jwt.sign(data, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  async login({ email, password, role }: LoginInput): Promise<AuthResponse> {
    console.log("Attempting to find user:", { email, role });

    // First find the user
    const user = (await prisma.user.findUnique({
      where: { email },
      include: {
        specialist: true,
      },
    })) as UserWithSpecialist | null;

    if (!user) {
      console.log("User not found:", { email });
      throw AppError.Unauthorized("Invalid credentials");
    }

    console.log("User found, checking role:", {
      expectedRole: role,
      actualRole: user.role,
    });

    if (user.role !== role) {
      console.log("Role mismatch:", {
        expectedRole: role,
        actualRole: user.role,
      });
      throw AppError.Forbidden("Invalid role for this user");
    }

    console.log("Validating password for user:", user.id);
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      console.log("Invalid password for user:", user.id);
      throw AppError.Unauthorized("Invalid credentials");
    }

    // For specialists, we'll need to verify their account status
    // This will be handled once we can regenerate the Prisma client
    if (role === UserRole.SPECIALIST) {
      console.log("Specialist login - verification check skipped temporarily");
    }

    console.log("Generating token for user:", user.id);
    const accessToken = this.generateToken({
      userId: user.id,
      role,
      specialistId: user.specialist?.id,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        profileImage: user.profileImage,
      },
      accessToken,
    };
  }

  async register(input: RegisterInput): Promise<AuthResponse> {
    const existingUser = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw AppError.Conflict("Email already registered");
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);

    try {
      // Create user first
      const user = (await prisma.user.create({
        data: {
          email: input.email,
          password: hashedPassword,
          firstName: input.firstName,
          lastName: input.lastName,
          role: input.role,
        },
        include: {
          specialist: true,
        },
      })) as UserWithSpecialist;

      // For specialists, we'll need to create their specialist record
      // This will be handled once we can regenerate the Prisma client
      if (input.role === UserRole.SPECIALIST) {
        if (!input.speciality || !input.license) {
          // If specialist data is missing, delete the user and throw error
          await prisma.user.delete({ where: { id: user.id } });
          throw AppError.ValidationError(
            "Speciality and license are required for specialists"
          );
        }
        console.log(
          "Specialist registration - specialist record creation skipped temporarily"
        );
      }

      const accessToken = this.generateToken({
        userId: user.id,
        role: user.role,
        specialistId: user.specialist?.id,
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          profileImage: user.profileImage,
        },
        accessToken,
      };
    } catch (error) {
      console.error("Registration error:", error);
      throw error;
    }
  }

  async validateToken(
    token: string
  ): Promise<{ userId: string; role: string; specialistId?: string }> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId: string;
        role: string;
        specialistId?: string;
      };
      return {
        userId: decoded.userId,
        role: decoded.role,
        specialistId: decoded.specialistId,
      };
    } catch (error) {
      throw AppError.Unauthorized("Invalid token");
    }
  }
}

export const authService = new AuthService();
