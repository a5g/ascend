import pino from 'pino';

export const createLogger = (serviceName: string) => {
    return pino({
        name: serviceName,
        level: process.env.LOG_LEVEL || 'info',
        timestamp: pino.stdTimeFunctions.isoTime,
        redact: {
            paths: [
                'password_hash',
                'zerodha_access_token',
                'authorization',
                'req.headers.authorization',
                'ENCRYPTION_KEY',
                'PAN',
                'phone',
                '*.password_hash',
                '*.zerodha_access_token',
                '*.authorization',
                '*.ENCRYPTION_KEY',
                '*.PAN',
                '*.phone',
                'user.password_hash',
                'user.zerodha_access_token'
            ],
            remove: true
        },
        ...(process.env.NODE_ENV !== 'production' && {
            transport: {
                target: 'pino-pretty',
                options: { colorize: true }
            }
        })
    });
};
