import { initTracing } from './tracing';

export const validateEncryptionKey = () => {
    if (!process.env.ENCRYPTION_KEY) {
        throw new Error('ENCRYPTION_KEY environment variable is required');
    }
};

export const validateJwtSecret = () => {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is required');
    }
};

export const bootstrapService = (serviceName: string) => {
    validateEncryptionKey();
    validateJwtSecret();
    initTracing(serviceName);
};
