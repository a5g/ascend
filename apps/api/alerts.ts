import { FastifyInstance } from 'fastify';
const { Alert } = require('@ascend/db');

export default async function (fastify: FastifyInstance) {
    fastify.post('/api/alerts', {
        schema: {
            body: {
                type: 'object',
                required: ['symbol', 'condition'],
                properties: {
                    symbol: { type: 'string' },
                    condition: { type: 'string' },
                    threshold: { type: 'number' },
                    reference_price: { type: 'number' },
                    channels: { type: 'array', items: { type: 'string' } },
                    active: { type: 'boolean' }
                }
            }
        }
    }, async (request, reply) => {
        // Mock user id extraction from JWT / auth middleware for now, defaulting to 1
        const userId = (request as any).user?.id || 1;
        const body: any = request.body;

        // Limit to 50 active alerts per user
        const activeCount = await Alert.count({ where: { user_id: userId, active: true } });
        if (activeCount >= 50) {
            return reply.status(400).send({ error: 'Maximum limit of 50 active alerts reached.' });
        }

        const newAlert = await Alert.create({
            user_id: userId,
            symbol: body.symbol.toUpperCase(),
            condition: body.condition,
            threshold: body.threshold,
            reference_price: body.reference_price,
            channels: body.channels || ['in-app'],
            active: true
        });

        return reply.status(201).send(newAlert);
    });

    fastify.get('/api/alerts', async (request, reply) => {
        const userId = (request as any).user?.id || 1;
        const query: any = request.query;

        const whereClause: any = { user_id: userId };
        if (query.active !== undefined) {
            whereClause.active = query.active === 'true';
        }

        const alerts = await Alert.findAll({ where: whereClause, order: [['createdAt', 'DESC']] });
        return reply.send(alerts);
    });

    fastify.put('/api/alerts/:id', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    condition: { type: 'string' },
                    reference_price: { type: 'number' },
                    threshold: { type: 'number' },
                    channels: { type: 'array', items: { type: 'string' } },
                    active: { type: 'boolean' }
                }
            }
        }
    }, async (request, reply) => {
        const userId = (request as any).user?.id || 1;
        const alertId = (request.params as any).id;
        const body: any = request.body;

        const alert = await Alert.findOne({ where: { id: alertId, user_id: userId } });
        if (!alert) {
            return reply.status(404).send({ error: 'Alert not found' });
        }

        const updates: any = {};
        if (body.condition !== undefined) updates.condition = body.condition;
        if (body.reference_price !== undefined) updates.reference_price = body.reference_price;
        if (body.threshold !== undefined) updates.threshold = body.threshold;
        if (body.channels !== undefined) updates.channels = body.channels;
        if (body.active !== undefined) {
            updates.active = body.active;
            // re-arming clears triggered_at
            if (body.active === true && !alert.active) {
                updates.triggered_at = null;
            }
        }

        await alert.update(updates);
        return reply.send({ data: alert });
    });

    fastify.delete('/api/alerts/:id', async (request, reply) => {
        const userId = (request as any).user?.id || 1;
        const alertId = (request.params as any).id;

        const deletedCount = await Alert.destroy({ where: { id: alertId, user_id: userId } });
        if (deletedCount === 0) {
            return reply.status(404).send({ error: 'Alert not found or ownership mismatch' });
        }

        return reply.send({ success: true });
    });
}
