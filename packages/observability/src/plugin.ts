import fp from 'fastify-plugin';
import crypto from 'crypto';
import client from 'prom-client';
import { httpRequestsTotal, httpRequestDuration } from './metrics';

const observabilityPlugin = async (fastify: any, options: any) => {
    fastify.addHook('onRequest', (request: any, reply: any, done: any) => {
        const requestId = request.headers['x-request-id'] || crypto.randomUUID();
        request.id = requestId as string;
        reply.header('x-request-id', requestId);

        request.log = fastify.log.child({ request_id: requestId, user_id: request.user?.id });

        request.startTime = process.hrtime();
        done();
    });

    fastify.addHook('onResponse', (request: any, reply: any, done: any) => {
        const hrtime = process.hrtime(request.startTime);
        const durationInSeconds = hrtime[0] + hrtime[1] / 1e9;

        const route = request.routeOptions?.url || request.url;

        httpRequestsTotal.inc({ method: request.method, route, status_code: reply.statusCode });
        httpRequestDuration.observe({ method: request.method, route, status_code: reply.statusCode }, durationInSeconds);

        done();
    });

    fastify.get('/metrics', async (request: any, reply: any) => {
        reply.header('Content-Type', client.register.contentType);
        return client.register.metrics();
    });
};

export const fastifyObservability = fp(observabilityPlugin);
