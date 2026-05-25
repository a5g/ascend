import { FastifyInstance } from 'fastify';
const { Fyers } = require('@ascend/db');
const { fyersModel } = require('fyers-api-v3');

const REDIRECT_URL = 'https://www.google.com';

function makeFyersClient(app_id: string, redirect_url = REDIRECT_URL) {
    const client = new fyersModel();
    client.setAppId(app_id);
    client.setRedirectUrl(redirect_url);
    return client;
}

export default async function fyersRoutes(fastify: FastifyInstance) {

    // GET /api/fyers — return current config (masks secret)
    fastify.get('/api/fyers', async (_request, reply) => {
        const record = await Fyers.findOne({ order: [['id', 'ASC']] });
        if (!record) return reply.send({ data: null });
        const r = record.toJSON();
        return reply.send({
            data: {
                id:                    r.id,
                fyer_id:               r.fyer_id,
                app_id:                r.app_id,
                secret:                r.secret ? `${r.secret.slice(0, 3)}${'*'.repeat(Math.max(0, r.secret.length - 3))}` : null,
                has_access_token:      !!r.access_token,
                has_refresh_token:     !!r.refresh_token,
                access_token_preview:  r.access_token  ? `${r.access_token.slice(0, 12)}…`  : null,
                refresh_token_preview: r.refresh_token ? `${r.refresh_token.slice(0, 12)}…` : null,
                access_token:          r.access_token  || null,
                refresh_token:         r.refresh_token || null,
            },
        });
    });

    // PUT /api/fyers — upsert app_id, secret, fyer_id
    fastify.put('/api/fyers', async (request, reply) => {
        const { app_id, secret, fyer_id } = request.body as {
            app_id: string; secret: string; fyer_id?: string;
        };
        if (!app_id?.trim() || !secret?.trim()) {
            return reply.status(400).send({ error: 'app_id and secret are required' });
        }
        let record = await Fyers.findOne({ order: [['id', 'ASC']] });
        if (record) {
            await record.update({ app_id: app_id.trim(), secret: secret.trim(), fyer_id: fyer_id?.trim() || null });
        } else {
            record = await Fyers.create({ app_id: app_id.trim(), secret: secret.trim(), fyer_id: fyer_id?.trim() || null });
        }
        return reply.send({ success: true });
    });

    // GET /api/fyers/auth-url — generate auth URL using app_id as client_id
    fastify.get('/api/fyers/auth-url', async (_request, reply) => {
        const record = await Fyers.findOne({ order: [['id', 'ASC']] });
        if (!record) return reply.status(404).send({ error: 'Fyers not configured. Save app_id and secret first.' });

        const app_id = record.get('app_id') as string;
        fastify.log.info({ app_id }, 'fyers auth-url debug');
        if (!app_id || app_id === 'undefined') return reply.status(400).send({ error: 'app_id is not set. Save configuration first.' });

        const params = new URLSearchParams({
            client_id:     app_id,
            redirect_uri:  REDIRECT_URL,
            response_type: 'code',
            state:         'ascend',
        });
        const url = `https://api-t1.fyers.in/api/v3/generate-authcode?${params}`;
        return reply.send({ data: { url } });
    });

    // POST /api/fyers/quotes — get live quotes for a list of symbols
    fastify.post('/api/fyers/quotes', async (request, reply) => {
        const { symbols } = request.body as { symbols: string[] };
        if (!Array.isArray(symbols) || symbols.length === 0) {
            return reply.status(400).send({ error: 'symbols array is required' });
        }

        const record = await Fyers.findOne({ order: [['id', 'ASC']] });
        if (!record) return reply.status(404).send({ error: 'Fyers not configured' });

        const app_id      = record.get('app_id')      as string;
        const access_token = record.get('access_token') as string | null;
        if (!access_token) {
            return reply.status(503).send({ error: 'Fyers access token not available. Complete authentication first.' });
        }

        try {
            const client = makeFyersClient(app_id);
            client.setAccessToken(access_token);
            const response = await client.getQuotes(symbols);

            if (response.s !== 'ok') {
                return reply.status(502).send({ error: response.message || 'Quote fetch failed' });
            }

            // Map to { symbol -> { lp, chp } } for easy consumption
            const quotes: Record<string, { lp: number | null; chp: number | null }> = {};
            for (const item of response.d ?? []) {
                quotes[item.n] = {
                    lp:  item.v?.lp  ?? null,
                    chp: item.v?.chp ?? null,
                };
            }

            return reply.send({ data: quotes });
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send({ error: err.message || 'Quote fetch failed' });
        }
    });

    // POST /api/fyers/token — exchange auth_code for access + refresh tokens via SDK
    fastify.post('/api/fyers/token', async (request, reply) => {
        const { auth_code } = request.body as { auth_code: string };
        if (!auth_code?.trim()) return reply.status(400).send({ error: 'auth_code is required' });

        const record = await Fyers.findOne({ order: [['id', 'ASC']] });
        if (!record) return reply.status(404).send({ error: 'Fyers not configured' });

        try {
            const app_id = record.get('app_id') as string;
            const secret = record.get('secret') as string;
            const client = makeFyersClient(app_id);
            const response = await client.generate_access_token({
                client_id:  app_id,
                secret_key: secret,
                auth_code:  auth_code.trim(),
            });

            if (response.s !== 'ok') {
                return reply.status(502).send({ error: response.message || 'Token generation failed' });
            }

            await record.update({
                access_token:  response.access_token,
                refresh_token: response.refresh_token,
            });

            return reply.send({ success: true, message: 'Tokens saved successfully' });
        } catch (err: any) {
            fastify.log.error(err);
            return reply.status(500).send({ error: err.message || 'Token generation failed' });
        }
    });
}
