import { bootstrapService, fastifyObservability, createLogger } from '@ascend/observability';
bootstrapService('super-admin-service');

import Fastify from 'fastify';
import fastifyHelmet from '@fastify/helmet';
import { User } from '@ascend/db';
import crypto from 'crypto';

const fastify = Fastify({ logger: createLogger('super-admin-service') });

fastify.register(fastifyObservability);
fastify.register(fastifyHelmet);

fastify.get('/health', async (request, reply) => {
  return { status: 'ok' };
});

fastify.get('/api/super-admin/services-health', async (request, reply) => {
  const services = [
    { name: 'Auth', url: 'http://localhost:3001/health' },
    { name: 'User', url: 'http://localhost:3002/health' },
    { name: 'Dashboard', url: 'http://localhost:3003/health' },
    { name: 'Order', url: 'http://localhost:3004/health' },
    { name: 'Portfolio', url: 'http://localhost:3005/health' },
    { name: 'Alerts', url: 'http://localhost:3000/health' },
  ];

  const results = await Promise.all(
    services.map(async (svc) => {
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(svc.url, { signal: controller.signal });
        clearTimeout(timeoutId);
        const latency = Date.now() - start;
        return {
          name: svc.name,
          status: res.ok ? 'UP' : 'DOWN',
          latency_ms: latency,
        };
      } catch (err) {
        return {
          name: svc.name,
          status: 'DOWN',
          latency_ms: Date.now() - start,
        };
      }
    })
  );
  return results;
});

fastify.post('/api/super-admin/users', async (request, reply) => {
  const { email, password, role } = request.body as any;
  if (!email || !password || !role) {
      return reply.status(400).send({ error: 'Missing required fields' });
  }

  try {
      // Mock hash for secure storage
      const password_hash = crypto.createHash('sha256').update(password).digest('hex');

      const user = await User.create({
          email,
          password_hash,
          role
      });
      return { id: user.id, email: user.email, role: user.role };
  } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: 'Failed to create user' });
  }
});

const start = async () => {
  try {
    await fastify.listen({ port: 3006, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
