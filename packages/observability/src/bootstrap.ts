import { initTracing } from './tracing';

export const validateEncryptionKey = () => {
    if (!process.env.ENCRYPTION_KEY) {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
        throw new Error('ENCRYPTION_KEY environment variable is required');
    }
};

export const validateJwtSecret = () => {
    if (!process.env.JWT_SECRET) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET environment variable is required');
    }
};

export const bootstrapService = (serviceName: string) => {
    validateEncryptionKey();
    validateJwtSecret();
    initTracing(serviceName);
};
