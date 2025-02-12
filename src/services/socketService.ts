import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';
import { verifyToken } from '../lib/jwt';
import { prisma } from '../lib/prisma';

export function initializeSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL,
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = verifyToken(token);
      socket.data.userId = decoded.id;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    const { appointmentId } = socket.handshake.query;
    
    if (typeof appointmentId !== 'string') {
      socket.disconnect();
      return;
    }

    // Join appointment room
    socket.join(appointmentId);

    // Handle new messages
    socket.on('send_message', async (content: string) => {
      try {
        // Verify user has access to this appointment
        const appointment = await prisma.appointment.findFirst({
          where: {
            id: appointmentId,
            OR: [
              { userId: socket.data.userId },
              { specialistId: socket.data.userId }
            ]
          }
        });

        if (!appointment) {
          socket.emit('error', 'Unauthorized');
          return;
        }

        // Create and save the message
        const message = await prisma.message.create({
          data: {
            content,
            appointmentId,
            senderId: socket.data.userId
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

        // Broadcast message to all users in the appointment room
        io.to(appointmentId).emit('message', message);
      } catch (error) {
        console.error('Error handling message:', error);
        socket.emit('error', 'Failed to send message');
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      socket.leave(appointmentId);
    });
  });

  return io;
} 