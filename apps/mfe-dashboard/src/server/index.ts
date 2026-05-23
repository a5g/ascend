import { bootstrapService, fastifyObservability, createLogger } from '@ascend/observability';
bootstrapService('mfe-dashboard');

import Fastify from 'fastify';
import fastifyHelmet from '@fastify/helmet';
import fastifyRedis from '@fastify/redis';
import { Server } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import dashboardRoutes from './routes/dashboard';

const fastify = Fastify({ loggerInstance: createLogger('mfe-dashboard') });

fastify.register(fastifyObservability);
fastify.register(fastifyHelmet);

fastify.register(fastifyRedis, {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
});

fastify.register(dashboardRoutes);

fastify.get('/health', async (_request, reply) => {
  return { status: 'ok' };
});

const start = async () => {
  try {
    await fastify.listen({ port: 3002, host: '0.0.0.0' });

    const io = new Server(fastify.server, {
      path: '/ws',
      cors: { origin: '*', methods: ['GET', 'POST'] },
    });

    io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication error'));

      jwt.verify(token, process.env.JWT_SECRET as string, (err: any, decoded: any) => {
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
      }

      socket.on('positions:refresh', () => {
        io.to(`user:${userId}`).emit('positions:update', { status: 'Positions refreshed' });
      });

      socket.on('disconnect', () => {
        fastify.log.info(`Client disconnected: ${socket.id}`);
      });
    });

    (fastify as any).io = io;
    (fastify as any).emitOrderUpdate = (userId: string, data: any) =>
      io.to(`user:${userId}`).emit('order:update', data);
    (fastify as any).emitPositionsUpdate = (userId: string, data: any) =>
      io.to(`user:${userId}`).emit('positions:update', data);

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
