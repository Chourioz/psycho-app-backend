import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { authService } from "../services/authService";

const prisma = new PrismaClient();

interface JWTPayload {
  userId: string;
  role: string;
  specialistId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: string;
        specialistId?: string;
      };
    }
  }
}

export const authenticateJWT = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Invalid token format" });
    }

    const decoded = await authService.validateToken(token);
    console.log("decoded", JSON.stringify(decoded, null, 4));
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

export const requireRole = (roles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "No authenticated user" });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
      });

      if (!user || !roles.includes(user.role)) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }

      next();
    } catch (error) {
      return res.status(500).json({ error: "Internal server error" });
    }
  };
};
