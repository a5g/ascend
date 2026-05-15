import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
// In a real app this should be securely managed. We use a fallback just to make tests/dev run.
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY || '12345678901234567890123456789012', 'utf8');

export const encrypt = (text: string) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    // Returning iv + authTag + encrypted
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

export const decrypt = (text: string) => {
    const [ivHex, authTagHex, encryptedHex] = text.split(':');

    if (!ivHex || !authTagHex || !encryptedHex) {
        throw new Error('Invalid encrypted format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
};
