import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const SEPARATOR = '$';

export class TokenCipherError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TokenCipherError';
    }
}

export const encryptToken = (key: Buffer, token: string): string => {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
    const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    return [VERSION, iv, cipher.getAuthTag(), ciphertext]
        .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
        .join(SEPARATOR);
};

export const decryptToken = (key: Buffer, stored: string): string => {
    const [version, iv, tag, ciphertext, ...rest] = stored.split(SEPARATOR);
    if (version !== VERSION || ciphertext === undefined || rest.length > 0) {
        throw new TokenCipherError('Not an encrypted token');
    }
    try {
        const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64url'), { authTagLength: TAG_BYTES });
        decipher.setAuthTag(Buffer.from(tag, 'base64url'));
        return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString(
            'utf8'
        );
    } catch {
        throw new TokenCipherError('The token cannot be decrypted with this GIT_TOKEN_KEY');
    }
};
