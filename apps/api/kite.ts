import { FastifyInstance } from 'fastify';
const { User } = require('@ascend/db');

export default async function kiteRoutes(fastify: FastifyInstance) {

  // POST /api/kite/bulk-token — bulk update zerodha_access_token by zerodha_user_id
  fastify.post('/api/kite/bulk-token', async (request, reply) => {
    const body = request.body as any;
    const tokens: Record<string, string> = body?.tokens;

    if (!tokens || typeof tokens !== 'object' || Array.isArray(tokens))
      return reply.status(400).send({ error: 'tokens must be a { zerodha_user_id: access_token } object' });

    const ids = Object.keys(tokens).map(k => k.trim()).filter(Boolean);
    if (ids.length === 0)
      return reply.status(400).send({ error: 'No user IDs provided' });

    const users = await User.findAll({
      where: { zerodha_user_id: ids },
      attributes: ['id', 'zerodha_user_id'],
    });

    const foundIds = new Set<string>(users.map((u: any) => u.get('zerodha_user_id')));
    const notFound = ids.filter(id => !foundIds.has(id));

    const now = new Date().toISOString();
    const updated: string[] = [];

    for (const user of users) {
      const uid = user.get('zerodha_user_id') as string;
      const token = tokens[uid]?.trim();
      if (!token) continue;
      await user.update({ zerodha_access_token: token, updatedAt: now });
      updated.push(uid);
    }

    return reply.send({ ok: true, updated, notFound });
  });
}
