import { initTracing } from './tracing';

export const validateEncryptionKey = () => {
    const key = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012';
    if (process.env.NODE_ENV === 'production' && key === '12345678901234567890123456789012') {
        throw new Error('Insecure ENCRYPTION_KEY used in production');
    }
};

export const validateJwtSecret = () => {
    const secret = process.env.JWT_SECRET || 'secret';
    if (process.env.NODE_ENV === 'production' && secret === 'secret') {
        throw new Error('Insecure JWT_SECRET used in production');
    }
};

export const bootstrapService = (serviceName: string) => {
    validateEncryptionKey();
    validateJwtSecret();
    initTracing(serviceName);
};
