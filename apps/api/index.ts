import type { IncomingMessage, ServerResponse } from 'http';

// dotenv is only needed locally; Vercel injects env vars at build time
if (!process.env.VERCEL) {
  require('dotenv').config({ path: '../../.env' });
}

import { bootstrapService, fastifyObservability, createLogger } from '@ascend/observability';
bootstrapService('api-gateway');

import Fastify from 'fastify';
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';

const allowedOrigins = [
  'http://localhost:3001',
  'http://localhost:4001',
  'http://localhost:4002',
  'http://localhost:4003',
  'http://localhost:4004',
  'http://localhost:4005',
  'http://localhost:4006',
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];

const fastify = Fastify({ loggerInstance: createLogger('api-gateway') });

fastify.register(fastifyObservability);

fastify.register(fastifyCors, {
  origin: allowedOrigins,
  credentials: true,
});

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

fastify.get('/health', async () => ({ status: 'ok' }));

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

import kiteRoutes from './kite';
fastify.register(kiteRoutes);

import fyersRoutes from './fyers';
fastify.register(fyersRoutes);

import tradeJournalRoutes from './trade-journal';
fastify.register(tradeJournalRoutes);

// Vercel serverless handler — reuses the same Fastify instance across warm invocations
export default async (req: IncomingMessage, res: ServerResponse) => {
  await fastify.ready();
  fastify.server.emit('request', req, res);
};

// Local development: start the HTTP server
if (!process.env.VERCEL) {
  fastify.listen({ port: 3000, host: '0.0.0.0' }).catch((err) => {
    fastify.log.error(err);
    process.exit(1);
  });
}
