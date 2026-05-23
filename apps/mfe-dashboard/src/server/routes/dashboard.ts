import { FastifyInstance } from 'fastify';
import { getZerodhaClient, createCircuitBreaker } from '@ascend/zerodha';
import { User } from '@ascend/db';
import { decrypt } from '@ascend/crypto';

export default async function dashboardRoutes(fastify: FastifyInstance) {

  const fetchHoldings = async (userId: string, accessToken: string) => {
    const kc = await getZerodhaClient(userId, accessToken);
    return kc.getHoldings();
  };

  const fetchPositions = async (userId: string, accessToken: string) => {
    const kc = await getZerodhaClient(userId, accessToken);
    return kc.getPositions();
  };

  const holdingsBreaker = createCircuitBreaker(fetchHoldings);
  const positionsBreaker = createCircuitBreaker(fetchPositions);

  const getRealToken = async (userId: number): Promise<string> => {
    const user = await User.findByPk(userId);
    if (!user || !user.zerodha_access_token) {
      throw new Error('Unauthorized');
    }
    return decrypt(user.zerodha_access_token);
  };

  fastify.get('/dashboard/holdings', async (request, reply) => {
    const userId = (request as any).user?.id || 1;
    const redisKey = `holdings:${userId}`;
    const { redis } = fastify as any;

    try {
      if (redis) {
        const cached = await redis.get(redisKey);
        if (cached) {
          return reply.send({ data: JSON.parse(cached), source: 'cache' });
        }
      }

      const accessToken = await getRealToken(userId);
      const holdings = await holdingsBreaker.fire(userId.toString(), accessToken);

      if (redis) {
        await redis.setex(redisKey, 300, JSON.stringify(holdings));
      }

      return reply.send({ data: holdings, source: 'zerodha' });
    } catch (error) {
      if (redis) {
        const stale = await redis.get(redisKey);
        if (stale) {
          return reply.send({ data: JSON.parse(stale), source: 'stale-cache', stale: true });
        }
      }
      fastify.log.error(error);
      return reply.status(503).send({ error: 'Service Unavailable' });
    }
  });

  fastify.get('/dashboard/positions', async (request, reply) => {
    const userId = (request as any).user?.id || 1;

    try {
      const accessToken = await getRealToken(userId);
      const positions = await positionsBreaker.fire(userId.toString(), accessToken);
      return reply.send({ data: positions, source: 'zerodha' });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(503).send({ error: 'Service Unavailable' });
    }
  });

  fastify.get('/dashboard/pnl', async (request, reply) => {
    const userId = (request as any).user?.id || 1;

    try {
      const accessToken = await getRealToken(userId);
      const [holdings, positions] = await Promise.all([
        holdingsBreaker.fire(userId.toString(), accessToken),
        positionsBreaker.fire(userId.toString(), accessToken),
      ]);

      let totalPnl = 0;
      if (holdings?.length > 0) {
        totalPnl += holdings.reduce((acc: number, curr: any) => acc + (curr.pnl || 0), 0);
      }
      if (positions?.net?.length > 0) {
        totalPnl += positions.net.reduce((acc: number, curr: any) => acc + (curr.pnl || 0), 0);
      }

      return reply.send({ data: { totalPnl } });
    } catch (error) {
      return reply.status(503).send({ error: 'Service Unavailable' });
    }
  });

  fastify.get('/dashboard/trades', async (_request, reply) => {
    return reply.send({ data: [] });
  });
}
