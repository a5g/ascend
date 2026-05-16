import { FastifyInstance } from 'fastify';
import { PositionSizingConfig } from '@ascend/db';

export default async function (fastify: FastifyInstance) {
  fastify.get('/configs', async (request, reply) => {
    const userId = (request as any).user.sub || (request as any).user.id || 1;
    const configs = await PositionSizingConfig.findAll({ where: { userId } });
    return reply.send(configs);
  });

  fastify.post('/configs', {
    schema: {
      body: {
        type: 'object',
        required: ['configName', 'strategy', 'parameters'],
        properties: {
          configName: { type: 'string' },
          strategy: { type: 'string' },
          parameters: { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    const userId = (request as any).user.sub || (request as any).user.id || 1;
    const { configName, strategy, parameters } = request.body as any;

    const config = await PositionSizingConfig.create({
      userId,
      configName,
      strategy,
      parameters
    });

    return reply.status(201).send(config);
  });

  fastify.delete('/configs/:id', async (request, reply) => {
    const userId = (request as any).user.sub || (request as any).user.id || 1;
    const id = (request.params as any).id;

    const config = await PositionSizingConfig.findOne({ where: { id, userId } });
    if (!config) {
      return reply.status(404).send({ error: 'Config not found' });
    }

    await config.destroy();
    return reply.send({ success: true });
  });
}
