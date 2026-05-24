require('dotenv').config({ path: '../../.env' });
import { bootstrapService, fastifyObservability, createLogger } from '@ascend/observability';
bootstrapService('api-gateway');

import Fastify from 'fastify';
import fastifyHelmet from '@fastify/helmet';

const fastify = Fastify({ loggerInstance: createLogger('api-gateway') });

fastify.register(fastifyObservability);

fastify.register(fastifyHelmet, {
  contentSecurityPolicy: {
    directives: {
      "script-src": ["'self'"],
      "frame-src": ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
});

fastify.get('/health', async (request, reply) => {
  return { status: 'ok' };
});

import alertsRoutes from './alerts';
fastify.register(alertsRoutes);

import notificationsRoutes from './notifications';
fastify.register(notificationsRoutes);

import usersRoutes from './users';
fastify.register(usersRoutes);

import securitiesRoutes from './securities';
fastify.register(securitiesRoutes);

import ordersRoutes from './orders';
fastify.register(ordersRoutes);

const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
