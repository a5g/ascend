import Fastify from 'fastify';
import zerodhaRoutes from './routes/zerodha';

const fastify = Fastify({ logger: true });

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
