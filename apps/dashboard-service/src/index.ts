import Fastify from 'fastify';
import dashboardRoutes from './routes/dashboard';
import fastifyRedis from '@fastify/redis';
import { Server } from 'socket.io';
import * as jwt from 'jsonwebtoken';

const fastify = Fastify({ logger: true });

// Setup Redis
fastify.register(fastifyRedis, {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
});

// Setup Routes
fastify.register(dashboardRoutes);

fastify.get('/health', async (request, reply) => {
  return { status: 'ok' };
});

const start = async () => {
  try {
    await fastify.listen({ port: 3002, host: '0.0.0.0' });

    // Setup WebSocket
    const io = new Server(fastify.server, {
        path: '/ws',
        cors: {
            origin: '*',
            methods: ['GET', 'POST']
        }
    });

    // JWT authentication middleware for Socket.io
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error'));
        }

        jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret', (err: any, decoded: any) => {
            if (err) return next(new Error('Authentication error'));
            socket.data.user = decoded;
            next();
        });
    });

    io.on('connection', (socket) => {
        fastify.log.info(`Client connected: ${socket.id}`);

        const userId = socket.data.user?.sub || socket.data.user?.id;
        if (userId) {
            socket.join(`user:${userId}`);
            fastify.log.info(`Socket ${socket.id} joined room user:${userId}`);
        }

        socket.on('positions:refresh', () => {
            // Emits back to the user room
            io.to(`user:${userId}`).emit('positions:update', { status: 'Positions refreshed' });
        });

        socket.on('disconnect', () => {
            fastify.log.info(`Client disconnected: ${socket.id}`);
        });
    });

    // Exported event emitters for Order Service
    const emitOrderUpdate = (userId: string, orderData: any) => {
        io.to(`user:${userId}`).emit('order:update', orderData);
    };

    const emitPositionsUpdate = (userId: string, positionsData: any) => {
        io.to(`user:${userId}`).emit('positions:update', positionsData);
    };

    // Attach to fastify instance for access in routes
    (fastify as any).io = io;
    (fastify as any).emitOrderUpdate = emitOrderUpdate;
    (fastify as any).emitPositionsUpdate = emitPositionsUpdate;

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();