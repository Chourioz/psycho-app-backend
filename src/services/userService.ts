import { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AppError } from '../utils/AppError';
import { prisma } from '../lib/prisma';

interface CreateUserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  speciality?: string;
  license?: string;
}

class UserService {
  async createUser(data: CreateUserData) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw AppError.Conflict('User already exists');
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    let user;
    try {
      // Create user
      user = await prisma.user.create({
        data: {
          email: data.email,
          password: hashedPassword,
          firstName: data.firstName,
          lastName: data.lastName,
          role: data.role,
        },
      });

      // If role is SPECIALIST, create specialist record
      if (data.role === UserRole.SPECIALIST) {
        if (!data.speciality || !data.license) {
          // If specialist creation fails, delete the user
          await prisma.user.delete({ where: { id: user.id } });
          throw AppError.ValidationError('Speciality and license are required for specialists');
        }

        const specialist = await prisma.specialist.create({
          data: {
            userId: user.id,
            speciality: data.speciality,
            license: data.license,
            isVerified: false
          }
        });

        return {
          ...user,
          specialist
        };
      }

      return user;
    } catch (error) {
      // If any error occurs during specialist creation, ensure user is deleted
      if (user) {
        await prisma.user.delete({ where: { id: user.id } });
      }
      throw error;
    }
  }
}

export const userService = new UserService(); 