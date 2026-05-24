import { FastifyInstance } from 'fastify';
import { Op, QueryTypes } from 'sequelize';
import crypto from 'crypto';
const { User, sequelize } = require('@ascend/db');

const PAGE_SIZE = 50;

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

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

    // GET /api/users — paginated list with search + role + status filters
    fastify.get('/api/users', async (request, reply) => {
        const { page = '1', search = '', role = '', is_active = '' } = request.query as {
            page?: string; search?: string; role?: string; is_active?: string;
        };
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const offset  = (pageNum - 1) * PAGE_SIZE;

        const where: any = {};
        if (search.trim()) {
            where[Op.or] = [
                { name:            { [Op.iLike]: `%${search.trim()}%` } },
                { email:           { [Op.iLike]: `%${search.trim()}%` } },
                { zerodha_user_id: { [Op.iLike]: `%${search.trim()}%` } },
            ];
        }
        if (role.trim()) where.role = role.trim();
        if (is_active === 'true')  where.is_active = true;
        if (is_active === 'false') where.is_active = false;

        const { count, rows } = await User.findAndCountAll({
            where,
            attributes: { exclude: ['password_hash'] },
            order:  [['name', 'ASC']],
            limit:  PAGE_SIZE,
            offset,
        });

        return reply.send({
            data:       rows,
            total:      count,
            page:       pageNum,
            totalPages: Math.ceil(count / PAGE_SIZE),
        });
    });

    // POST /api/users — create a user
    fastify.post('/api/users', async (request, reply) => {
        const body = request.body as {
            email: string; password: string; role?: string; name?: string;
            zerodha_user_id?: string; capital?: number | null;
            zerodha_access_token?: string; zerodha_password?: string;
            is_active?: boolean;
        };

        if (!body.email?.trim()) return reply.status(400).send({ error: 'email is required' });
        if (!body.password?.trim()) return reply.status(400).send({ error: 'password is required' });

        try {
            const user = await User.create({
                email:                body.email.trim().toLowerCase(),
                password_hash:        hashPassword(body.password),
                role:                 body.role?.trim() || 'user',
                name:                 body.name?.trim() || null,
                zerodha_user_id:      body.zerodha_user_id?.trim() || null,
                capital:              body.capital ?? null,
                zerodha_access_token: body.zerodha_access_token?.trim() || null,
                zerodha_password:     body.zerodha_password?.trim() || null,
                is_active:            body.is_active ?? false,
            });
            const { password_hash: _, ...safe } = user.toJSON();
            return reply.status(201).send({ data: safe });
        } catch (err: any) {
            if (err?.name === 'SequelizeUniqueConstraintError') {
                return reply.status(409).send({ error: 'A user with this email already exists' });
            }
            throw err;
        }
    });

    // PUT /api/users/:id — update any fields
    fastify.put('/api/users/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const body = request.body as {
            name?: string; email?: string; role?: string; is_active?: boolean;
            zerodha_user_id?: string | null; capital?: number | null;
            zerodha_access_token?: string | null; zerodha_password?: string | null;
            password?: string;
        };

        const user = await User.findByPk(parseInt(id, 10));
        if (!user) return reply.status(404).send({ error: 'User not found' });

        const updates: Record<string, any> = {};
        if (body.name         !== undefined) updates.name                 = body.name?.trim() || null;
        if (body.email        !== undefined) updates.email                = body.email.trim().toLowerCase();
        if (body.role         !== undefined) updates.role                 = body.role.trim();
        if (body.is_active    !== undefined) updates.is_active            = body.is_active;
        if (body.zerodha_user_id      !== undefined) updates.zerodha_user_id      = body.zerodha_user_id || null;
        if (body.capital              !== undefined) updates.capital              = body.capital ?? null;
        if (body.zerodha_access_token !== undefined) updates.zerodha_access_token = body.zerodha_access_token || null;
        if (body.zerodha_password     !== undefined) updates.zerodha_password     = body.zerodha_password || null;
        if (body.password?.trim())                   updates.password_hash        = hashPassword(body.password);

        await user.update(updates);
        const { password_hash: _, ...safe } = user.toJSON();
        return reply.send({ data: safe });
    });

    // DELETE /api/users/:id
    fastify.delete('/api/users/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const user = await User.findByPk(parseInt(id, 10));
        if (!user) return reply.status(404).send({ error: 'User not found' });
        await user.destroy();
        return reply.send({ success: true });
    });

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
