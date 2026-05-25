import { FastifyInstance } from 'fastify';
import { QueryTypes } from 'sequelize';
const { sequelize } = require('@ascend/db');

const KITE_API_HOST = 'https://kite.zerodha.com';

export default async function ordersRoutes(fastify: FastifyInstance) {

    // POST /api/orders — place a regular BUY order via Zerodha for one user
    fastify.post('/api/orders', async (request, reply) => {
        const body = request.body as {
            zerodha_user_id: string;
            exchange: string;
            tradingSymbol: string;
            transaction_type: 'BUY' | 'SELL';
            order_type: 'LIMIT' | 'MARKET';
            price: number;
            qty: number;
            variety?: string;
            product?: string;
            validity?: string;
            disclosed_quantity?: number;
            trigger_price?: number;
            squareoff?: number;
            stoploss?: number;
            trailing_stoploss?: number;
        };

        const {
            zerodha_user_id, exchange, tradingSymbol, transaction_type, order_type, price, qty,
            variety            = 'regular',
            product            = 'CNC',
            validity           = 'DAY',
            disclosed_quantity = 0,
            trigger_price      = 0,
            squareoff          = 0,
            stoploss           = 0,
            trailing_stoploss  = 0,
        } = body;

        if (!zerodha_user_id?.trim() || !exchange?.trim() || !tradingSymbol?.trim() || !transaction_type || !order_type || !qty) {
            return reply.status(400).send({ error: 'Missing required fields' });
        }
        if (!['BUY', 'SELL'].includes(transaction_type)) {
            return reply.status(400).send({ error: 'transaction_type must be BUY or SELL' });
        }
        if (!['LIMIT', 'MARKET'].includes(order_type)) {
            return reply.status(400).send({ error: 'order_type must be LIMIT or MARKET' });
        }

        const rows = await sequelize.query(
            `SELECT zerodha_user_id, zerodha_access_token FROM users
             WHERE zerodha_user_id = :userId AND is_active = true LIMIT 1`,
            { replacements: { userId: zerodha_user_id.trim() }, type: QueryTypes.SELECT }
        ) as { zerodha_user_id: string; zerodha_access_token: string | null }[];

        const user = rows[0];
        if (!user) {
            return reply.status(404).send({ error: `Active user ${zerodha_user_id} not found` });
        }
        if (!user.zerodha_access_token) {
            return reply.status(400).send({ error: `No access token configured for ${zerodha_user_id}` });
        }

        const params = new URLSearchParams({
            variety,
            exchange:           exchange.toUpperCase(),
            tradingsymbol:      tradingSymbol.toUpperCase(),
            transaction_type:   transaction_type.toUpperCase(),
            order_type:         order_type,
            quantity:           String(Math.trunc(qty)),
            price:              order_type === 'LIMIT' ? String(price) : '0',
            product,
            validity,
            disclosed_quantity: String(disclosed_quantity),
            trigger_price:      String(trigger_price),
            squareoff:          String(squareoff),
            stoploss:           String(stoploss),
            trailing_stoploss:  String(trailing_stoploss),
        });

        try {
            const res = await fetch(`${KITE_API_HOST}/oms/orders/regular`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Authorization: `enctoken ${user.zerodha_access_token}`,
                },
                body: params.toString(),
            });

            const data = await res.json() as any;
            if (!res.ok) {
                return reply.status(res.status).send({
                    error: data?.message || data?.error_type || 'Order placement failed',
                });
            }
            return reply.send({ data });
        } catch (err: any) {
            throw err;
        }
    });

    // GET /api/orders/user/:userId — list all orders for a user
    fastify.get('/api/orders/user/:userId', async (request, reply) => {
        const { userId } = request.params as { userId: string };

        const rows = await sequelize.query(
            `SELECT zerodha_user_id, zerodha_access_token FROM users
             WHERE zerodha_user_id = :userId AND is_active = true LIMIT 1`,
            { replacements: { userId: userId.trim() }, type: QueryTypes.SELECT }
        ) as { zerodha_user_id: string; zerodha_access_token: string | null }[];

        const user = rows[0];
        if (!user) return reply.status(404).send({ error: `Active user ${userId} not found` });
        if (!user.zerodha_access_token) return reply.status(400).send({ error: `No access token for ${userId}` });

        try {
            const res = await fetch(`${KITE_API_HOST}/oms/orders`, {
                headers: { Authorization: `enctoken ${user.zerodha_access_token}` },
            });
            const data = await res.json() as any;
            if (!res.ok) return reply.status(res.status).send({ error: data?.message || 'Failed to fetch orders' });
            return reply.send({ data: data.data ?? [] });
        } catch (err: any) {
            throw err;
        }
    });

    // DELETE /api/orders/:orderId — cancel an order
    fastify.delete('/api/orders/:orderId', async (request, reply) => {
        const { orderId } = request.params as { orderId: string };
        const { zerodha_user_id, variety = 'regular' } = request.body as { zerodha_user_id: string; variety?: string };

        if (!zerodha_user_id?.trim()) return reply.status(400).send({ error: 'zerodha_user_id is required' });

        const rows = await sequelize.query(
            `SELECT zerodha_access_token FROM users WHERE zerodha_user_id = :userId AND is_active = true LIMIT 1`,
            { replacements: { userId: zerodha_user_id.trim() }, type: QueryTypes.SELECT }
        ) as { zerodha_access_token: string | null }[];

        const user = rows[0];
        if (!user) return reply.status(404).send({ error: `User ${zerodha_user_id} not found` });
        if (!user.zerodha_access_token) return reply.status(400).send({ error: `No access token for ${zerodha_user_id}` });

        const qs = new URLSearchParams({ order_id: orderId, parent_order_id: '', variety });

        try {
            const res = await fetch(`${KITE_API_HOST}/oms/orders/${variety}/${orderId}?${qs}`, {
                method: 'DELETE',
                headers: { Authorization: `enctoken ${user.zerodha_access_token}` },
            });
            const data = await res.json() as any;
            if (!res.ok) return reply.status(res.status).send({ error: data?.message || 'Cancel failed' });
            return reply.send({ data });
        } catch (err: any) {
            throw err;
        }
    });

    // PUT /api/orders/:orderId — modify an order
    fastify.put('/api/orders/:orderId', async (request, reply) => {
        const { orderId } = request.params as { orderId: string };
        const body = request.body as {
            zerodha_user_id: string;
            variety?: string;
            exchange: string;
            tradingsymbol: string;
            transaction_type: string;
            order_type: 'LIMIT' | 'MARKET';
            quantity: number;
            price: number;
            product: string;
            validity?: string;
            disclosed_quantity?: number;
            trigger_price?: number;
            squareoff?: number;
            stoploss?: number;
            trailing_stoploss?: number;
        };

        const {
            zerodha_user_id, variety = 'regular', exchange, tradingsymbol, transaction_type,
            order_type, quantity, price, product, validity = 'DAY',
            disclosed_quantity = 0, trigger_price = 0, squareoff = 0, stoploss = 0, trailing_stoploss = 0,
        } = body;

        if (!zerodha_user_id?.trim()) return reply.status(400).send({ error: 'zerodha_user_id is required' });

        const rows = await sequelize.query(
            `SELECT zerodha_access_token FROM users WHERE zerodha_user_id = :userId AND is_active = true LIMIT 1`,
            { replacements: { userId: zerodha_user_id.trim() }, type: QueryTypes.SELECT }
        ) as { zerodha_access_token: string | null }[];

        const user = rows[0];
        if (!user) return reply.status(404).send({ error: `User ${zerodha_user_id} not found` });
        if (!user.zerodha_access_token) return reply.status(400).send({ error: `No access token for ${zerodha_user_id}` });

        const params = new URLSearchParams({
            variety,
            exchange:           exchange.toUpperCase(),
            tradingsymbol:      tradingsymbol.toUpperCase(),
            transaction_type:   transaction_type.toUpperCase(),
            order_type,
            quantity:           String(Math.trunc(quantity)),
            price:              order_type === 'LIMIT' ? String(price) : '0',
            product,
            validity,
            disclosed_quantity: String(disclosed_quantity),
            trigger_price:      String(trigger_price),
            squareoff:          String(squareoff),
            stoploss:           String(stoploss),
            trailing_stoploss:  String(trailing_stoploss),
            order_id:           orderId,
            parent_order_id:    '',
        });

        try {
            const res = await fetch(`${KITE_API_HOST}/oms/orders/${variety}/${orderId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Authorization: `enctoken ${user.zerodha_access_token}`,
                },
                body: params.toString(),
            });
            const data = await res.json() as any;
            if (!res.ok) return reply.status(res.status).send({ error: data?.message || 'Modify failed' });
            return reply.send({ data });
        } catch (err: any) {
            throw err;
        }
    });

    // GET /api/positions/user/:userId — get net positions for a user
    fastify.get('/api/positions/user/:userId', async (request, reply) => {
        const { userId } = request.params as { userId: string };

        const rows = await sequelize.query(
            `SELECT zerodha_access_token FROM users WHERE zerodha_user_id = :userId AND is_active = true LIMIT 1`,
            { replacements: { userId: userId.trim() }, type: QueryTypes.SELECT }
        ) as { zerodha_access_token: string | null }[];

        const user = rows[0];
        if (!user) return reply.status(404).send({ error: `Active user ${userId} not found` });
        if (!user.zerodha_access_token) return reply.status(400).send({ error: `No access token for ${userId}` });

        try {
            const res = await fetch(`${KITE_API_HOST}/oms/portfolio/positions`, {
                headers: { Authorization: `enctoken ${user.zerodha_access_token}` },
            });
            const data = await res.json() as any;
            if (!res.ok) return reply.status(res.status).send({ error: data?.message || 'Failed to fetch positions' });
            return reply.send({ data: data.data?.net ?? [] });
        } catch (err: any) {
            throw err;
        }
    });
}
