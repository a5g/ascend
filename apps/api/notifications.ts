import { FastifyInstance } from 'fastify';
const { Notification } = require('@ascend/db');

export default async function (fastify: FastifyInstance) {
    fastify.get('/api/notifications', async (request, reply) => {
        const userId = (request as any).user?.id || 1;
        const query: any = request.query;

        const limit = parseInt(query.limit) || 20;
        const offset = parseInt(query.offset) || 0;

        const notifications = await Notification.findAndCountAll({
            where: { user_id: userId },
            order: [['createdAt', 'DESC']],
            limit,
            offset
        });

        return reply.send({
            data: notifications.rows,
            total: notifications.count,
            limit,
            offset
        });
    });

    fastify.put('/api/notifications/:id/read', async (request, reply) => {
        const userId = (request as any).user?.id || 1;
        const notificationId = (request.params as any).id;

        const notification = await Notification.findOne({ where: { id: notificationId, user_id: userId } });
        if (!notification) {
            return reply.status(404).send({ error: 'Notification not found' });
        }

        await notification.update({ is_read: true });
        return reply.send({ data: notification });
    });

    fastify.put('/api/notifications/read-all', async (request, reply) => {
        const userId = (request as any).user?.id || 1;

        await Notification.update(
            { is_read: true },
            { where: { user_id: userId, is_read: false } }
        );

        return reply.send({ success: true });
    });

    fastify.get('/api/notifications/unread-count', async (request, reply) => {
        const userId = (request as any).user?.id || 1;

        const count = await Notification.count({
            where: { user_id: userId, is_read: false }
        });

        return reply.send({ unread_count: count });
    });
}
