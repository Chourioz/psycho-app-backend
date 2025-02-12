import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateJWT } from '../middleware/auth';
import { AuthenticatedRequest } from '../types/auth';

const router = Router();

// Get messages for an appointment
router.get('/appointments/:appointmentId/messages', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const { appointmentId } = req.params;

    // Verify user has access to this appointment
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        OR: [
          { userId: req.user.userId },
          { specialistId: req.user.userId }
        ]
      }
    });

    if (!appointment) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Get messages with sender information
    const messages = await prisma.message.findMany({
      where: { appointmentId },
      include: {
        sender: {
          select: {
            firstName: true,
            lastName: true,
            profileImage: true
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Create a new message (REST fallback for WebSocket)
router.post('/appointments/:appointmentId/messages', authenticateJWT, async (req: AuthenticatedRequest, res) => {
  try {
    const { appointmentId } = req.params;
    const { content } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Verify user has access to this appointment
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: appointmentId,
        OR: [
          { userId: req.user.userId },
          { specialistId: req.user.userId }
        ]
      }
    });

    if (!appointment) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        content,
        appointmentId,
        senderId: req.user.userId
      },
      include: {
        sender: {
          select: {
            firstName: true,
            lastName: true,
            profileImage: true
          }
        }
      }
    });

    res.json(message);
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ error: 'Failed to create message' });
  }
});

export default router; 