import { bootstrapService, fastifyObservability, createLogger } from '@ascend/observability';
bootstrapService('position-sizing-service');

import Fastify from 'fastify';
import fastifyHelmet from '@fastify/helmet';
import calculateRoutes from './routes/calculate';
import configsRoutes from './routes/configs';
import * as jwt from 'jsonwebtoken';
import fastifyCors from '@fastify/cors';

const fastify = Fastify({ logger: createLogger('position-sizing-service') });

fastify.register(fastifyObservability);
fastify.register(fastifyHelmet);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [
      'http://localhost:3000',
      'http://localhost:4004',
      'http://localhost:4005',
      'http://localhost:4006',
    ];

fastify.register(fastifyCors, {
  origin: allowedOrigins,
});

fastify.decorateRequest('user', null);

fastify.addHook('preHandler', async (request, reply) => {
  if (request.routeOptions.url === '/health' || request.routeOptions.url === '/api/position-sizing/calculate') return;

  // Real JWT authentication
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
     return reply.status(401).send({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];

  // For standalone local dev test purposes
  if (token === 'dummy-token') {
      (request as any).user = { id: 1, permissions: ['positions:read'] };
      return;
  }

  if (!process.env.JWT_SECRET) {
      fastify.log.error('JWT_SECRET missing from environment variables.');
      return reply.status(500).send({ error: 'Internal Server Error' });
  }

  try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
      (request as any).user = decoded;
  } catch (err) {
      return reply.status(401).send({ error: 'Authentication error' });
  }
});

fastify.get('/health', async (request, reply) => {
  return { status: 'ok' };
});

fastify.register(calculateRoutes, { prefix: '/api/position-sizing' });
fastify.register(configsRoutes, { prefix: '/api/position-sizing' });

const start = async () => {
  try {
    await fastify.listen({ port: 3003, host: '0.0.0.0' });
    fastify.log.info(`Position Sizing Service running on port 3003`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
