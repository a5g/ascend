import { bootstrapService, fastifyObservability, createLogger } from '@ascend/observability';
bootstrapService('auth-service');

import Fastify from 'fastify';
import fastifyHelmet from '@fastify/helmet';
import fastifyCookie from '@fastify/cookie';
import fastifyCsrfProtection from '@fastify/csrf-protection';
import zerodhaRoutes from './routes/zerodha';

const fastify = Fastify({ logger: createLogger('auth-service') });

fastify.register(fastifyObservability);
fastify.register(fastifyHelmet);
fastify.register(fastifyCookie);
fastify.register(fastifyCsrfProtection);

fastify.register(zerodhaRoutes);

fastify.get('/health', async (request, reply) => {
  return { status: 'ok' };
});

const start = async () => {
  try {
    await fastify.listen({ port: 3001, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
