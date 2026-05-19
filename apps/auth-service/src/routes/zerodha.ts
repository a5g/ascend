import { FastifyInstance } from 'fastify';
import { KiteConnect } from 'kiteconnect';
import { encrypt } from '@ascend/crypto';
import { User } from '@ascend/db';

export default async function (fastify: FastifyInstance) {
  if (!process.env.ZERODHA_API_KEY) {
    throw new Error('ZERODHA_API_KEY is not defined');
  }
  const kc = new KiteConnect({
    api_key: process.env.ZERODHA_API_KEY,
  });

  fastify.post('/auth/zerodha/connect', async (request, reply) => {
    const loginUrl = kc.getLoginURL();
    return reply.send({ loginUrl });
  });

  fastify.get('/auth/zerodha/callback', async (request, reply) => {
    const { request_token } = request.query as { request_token: string };

    try {
      if (!process.env.ZERODHA_API_SECRET) {
        throw new Error('ZERODHA_API_SECRET is not defined');
      }

      const response = await kc.generateSession(
        request_token,
        process.env.ZERODHA_API_SECRET
      );

      const accessToken = response.access_token;
      const encryptedToken = encrypt(accessToken);

      // Get real userId, assuming it's available via auth middleware. Hardcoding for setup/test
      const userId = (request as any).user?.id || 1;

      await User.update(
          { zerodha_access_token: encryptedToken },
          { where: { id: userId } }
      );

      return reply.send({ success: true });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({ error: 'Failed to generate session' });
    }
  });

  fastify.get('/auth/zerodha/status', async (request, reply) => {
    const userId = (request as any).user?.id || 1;

    const user = await User.findByPk(userId);
    if (!user || !user.zerodha_access_token) {
        return reply.status(401).send({ connected: false });
    }

    return reply.send({ connected: true });
  });

  fastify.delete('/auth/zerodha/disconnect', async (request, reply) => {
    const userId = (request as any).user?.id || 1;
    await User.update({ zerodha_access_token: null }, { where: { id: userId } });
    return reply.send({ success: true });
  });
}