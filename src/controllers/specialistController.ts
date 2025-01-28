import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../utils/AppError';
import { UserRole } from '@prisma/client';

interface SpecialistResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profileImage: string | null;
  speciality: string;
  isVerified?: boolean;
}

export class SpecialistController {
  async getAll(req: Request, res: Response) {
    try {
      const specialists = await prisma.$queryRaw<SpecialistResult[]>`
        SELECT 
          s.id,
          u."firstName",
          u."lastName",
          u.email,
          u."profileImage",
          s.speciality
        FROM "User" u
        JOIN "Specialist" s ON u.id = s."userId"
        WHERE u.role = 'SPECIALIST'
        AND s."isVerified" = true
      `;

      res.json({
        status: 'success',
        data: specialists || []
      });
    } catch (error) {
      console.error('Error fetching specialists:', error);
      throw new AppError(500, 'Failed to fetch specialists');
    }
  }

  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const [specialist] = await prisma.$queryRaw<SpecialistResult[]>`
        SELECT 
          s.id,
          u.first_name as "firstName",
          u.last_name as "lastName",
          u.email,
          u.profile_image as "profileImage",
          s.speciality,
          s.is_verified as "isVerified"
        FROM "User" u
        JOIN "Specialist" s ON u.id = s.user_id
        WHERE s.id = ${id}
      `;

      if (!specialist) {
        return res.json({
          status: 'success',
          data: null
        });
      }

      if (!specialist.isVerified) {
        throw AppError.Forbidden('Specialist not verified');
      }

      res.json({
        status: 'success',
        data: specialist
      });
    } catch (error) {
      console.error('Error fetching specialist:', error);
      throw new AppError(500, 'Failed to fetch specialist');
    }
  }
} 