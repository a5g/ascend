import client from 'prom-client';

client.collectDefaultMetrics();

export const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
});

export const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
});

export const zerodhaCallsTotal = new client.Counter({
    name: 'zerodha_calls_total',
    help: 'Total number of Zerodha API calls',
    labelNames: ['endpoint', 'status'],
});

export const zerodhaCircuitBreakerState = new client.Gauge({
    name: 'zerodha_circuit_breaker_state',
    help: 'State of the Zerodha circuit breaker (0=closed, 1=open)',
});

export const zerodhaLatency = new client.Histogram({
    name: 'zerodha_latency_seconds',
    help: 'Latency of Zerodha API calls',
    labelNames: ['endpoint'],
});

export const queueMessagesPublished = new client.Counter({
    name: 'queue_messages_published_total',
    help: 'Total number of messages published to queue',
    labelNames: ['queue'],
});

export const queueMessagesConsumed = new client.Counter({
    name: 'queue_messages_consumed_total',
    help: 'Total number of messages consumed from queue',
    labelNames: ['queue'],
});

export const activeWebSocketConnections = new client.Gauge({
    name: 'active_websocket_connections',
    help: 'Number of active WebSocket connections',
});

export const loginAttemptsTotal = new client.Counter({
    name: 'login_attempts_total',
    help: 'Total number of login attempts',
    labelNames: ['status'],
});

export const tokenRefreshTotal = new client.Counter({
    name: 'token_refresh_total',
    help: 'Total number of token refresh events',
    labelNames: ['status'],
});
