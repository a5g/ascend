import { FastifyInstance } from 'fastify';
import { Op, QueryTypes } from 'sequelize';
const { User, sequelize } = require('@ascend/db');

const KITE_API_HOST = 'https://kite.zerodha.com';

async function fetchKiteHoldings(userId: string, enctoken: string) {
    const res = await fetch(`${KITE_API_HOST}/oms/portfolio/holdings`, {
        method: 'GET',
        headers: {
            Authorization: `enctoken ${enctoken}`,
        },
    });

    if (res.status === 403) {
        throw new Error(`enctoken for ${userId} is invalid or expired`);
    }

    if (!res.ok) {
        throw new Error(`Kite API error: ${res.status} ${res.statusText}`);
    }

    const body = await res.json() as { status: string; data: any[] };

    if (body.status !== 'success') {
        throw new Error(`Kite API returned non-success status for ${userId}`);
    }

    return body.data;
}

export default async function usersRoutes(fastify: FastifyInstance) {

    // GET /api/users/active — list zerodha_user_id + name for all active users
    fastify.get('/api/users/active', async (_request, reply) => {
        const users = await User.findAll({
            where: {
                is_active: true,
                zerodha_user_id: { [Op.not]: null },
            },
            attributes: ['zerodha_user_id', 'name'],
            order: [['name', 'ASC']],
        });

        return reply.send({ data: users });
    });

    // GET /api/users/:userId/holdings — fetch live holdings from Zerodha for one user
    fastify.get('/api/users/:userId/holdings', async (request, reply) => {
        const { userId } = request.params as { userId: string };

        const rows = await sequelize.query(
            `SELECT zerodha_user_id, name, zerodha_access_token FROM users WHERE zerodha_user_id = :userId AND is_active = true LIMIT 1`,
            { replacements: { userId }, type: QueryTypes.SELECT }
        );
        const userRow = rows[0] as { zerodha_user_id: string; name: string | null; zerodha_access_token: string | null } | undefined;

        if (!userRow) {
            return reply.status(404).send({ error: 'Active user not found' });
        }

        if (!userRow.zerodha_access_token) {
            return reply.status(403).send({ error: 'No access token on file for this user' });
        }

        const redisKey = `holdings:${userId}`;
        const redis = (fastify as any).redis;

        try {
            if (redis) {
                const cached = await redis.get(redisKey);
                if (cached) {
                    return reply.send({ data: JSON.parse(cached), source: 'cache' });
                }
            }

            const holdings = await fetchKiteHoldings(userId, userRow.zerodha_access_token);

            if (redis) {
                await redis.setex(redisKey, 300, JSON.stringify(holdings));
            }

            return reply.send({ data: holdings, source: 'zerodha' });

        } catch (error: any) {
            fastify.log.error(error);

            if (redis) {
                const stale = await redis.get(redisKey);
                if (stale) {
                    return reply.send({ data: JSON.parse(stale), source: 'stale-cache', stale: true });
                }
            }

            const is403 = error?.message?.includes('invalid or expired');
            return reply
                .status(is403 ? 403 : 503)
                .send({ error: error.message || 'Unable to fetch holdings from Kite' });
        }
    });
}
