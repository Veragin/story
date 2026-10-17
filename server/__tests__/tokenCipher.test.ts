import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decryptToken, encryptToken, TokenCipherError } from '../src/git/tokenCipher';

const KEY = randomBytes(32);

describe('tokenCipher', () => {
    it('round-trips, with a fresh IV each time', () => {
        const a = encryptToken(KEY, 'ghp_secret');
        const b = encryptToken(KEY, 'ghp_secret');
        expect(a).toMatch(/^v1\$[\w-]+\$[\w-]+\$[\w-]+$/);
        expect(a).not.toBe(b);
        expect(a).not.toContain('ghp_secret');
        expect(decryptToken(KEY, a)).toBe('ghp_secret');
    });

    it('refuses a wrong key, a tampered tag or ciphertext, and garbage', () => {
        const stored = encryptToken(KEY, 'ghp_secret');
        const [version, iv, tag, ciphertext] = stored.split('$');
        const flip = (part: string) => {
            const bytes = Buffer.from(part, 'base64url');
            bytes[0] ^= 1;
            return bytes.toString('base64url');
        };
        expect(() => decryptToken(randomBytes(32), stored)).toThrow(TokenCipherError);
        expect(() => decryptToken(KEY, [version, iv, flip(tag), ciphertext].join('$'))).toThrow(TokenCipherError);
        expect(() => decryptToken(KEY, [version, iv, tag, flip(ciphertext)].join('$'))).toThrow(TokenCipherError);
        expect(() => decryptToken(KEY, ['v2', iv, tag, ciphertext].join('$'))).toThrow(TokenCipherError);
        expect(() => decryptToken(KEY, 'plain-token')).toThrow(TokenCipherError);
    });
});
