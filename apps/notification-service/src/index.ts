import Fastify from 'fastify';
import amqp from 'amqplib';

const fastify = Fastify({ logger: true });

export let connection: any;
export let channel: amqp.Channel;

export async function setupRabbitMQ() {
    connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
    channel = await connection.createChannel();

    // DLX Setup
    await channel.assertExchange('stockportal.dlx', 'direct', { durable: true });
    await channel.assertQueue('notification.failed', { durable: true });
    await channel.bindQueue('notification.failed', 'stockportal.dlx', 'failed');

    // Channels Queues (with TTL and DLX)
    const queues = ['notification.in-app', 'notification.email', 'notification.sms'];
    for (const q of queues) {
        await channel.assertQueue(q, {
            durable: true,
            arguments: {
                'x-message-ttl': 24 * 60 * 60 * 1000, // 24 hours TTL
                'x-dead-letter-exchange': 'stockportal.dlx',
                'x-dead-letter-routing-key': 'failed'
            }
        });
    }

    fastify.log.info('RabbitMQ setup complete.');
}

fastify.get('/health', async () => {
    return { status: 'ok' };
});

const start = async () => {
    try {
        if(process.env.NODE_ENV !== 'test') {
           await setupRabbitMQ();
        }

        const { startEvaluator } = require('./evaluator');
        startEvaluator();

        const { startConsumers } = require('./sender');
        await startConsumers();

        await fastify.listen({ port: 3003, host: '0.0.0.0' });
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
