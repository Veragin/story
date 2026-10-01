import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const DEFAULT_PARAMS = { N: 16384, r: 8, p: 1 };
const SALT_BYTES = 16;
const KEY_BYTES = 64;

// imported hashes carry outside parameters; uncapped N could allocate gigabytes per login
const MAX_N = 2 ** 20;
const MAX_R = 32;
const MAX_P = 16;
const MAX_KEY_BYTES = 256;

const scryptAsync = (password: string, salt: Buffer, keylen: number, options: ScryptOptions) =>
    new Promise<Buffer>((resolve, reject) =>
        scrypt(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key)))
    );

// scrypt needs 128·N·r bytes; the default 32 MB maxmem would refuse larger allowed N
const optionsFor = (N: number, r: number, p: number): ScryptOptions => ({ N, r, p, maxmem: 256 * N * r });

export const hashPassword = async (password: string): Promise<string> => {
    const { N, r, p } = DEFAULT_PARAMS;
    const salt = randomBytes(SALT_BYTES);
    const key = await scryptAsync(password, salt, KEY_BYTES, optionsFor(N, r, p));
    return ['scrypt', N, r, p, salt.toString('base64url'), key.toString('base64url')].join('$');
};

const parseScrypt = (stored: string) => {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
    const [N, r, p] = parts.slice(1, 4).map((v) => (/^\d+$/.test(v) ? Number(v) : NaN));
    const salt = Buffer.from(parts[4], 'base64url');
    const key = Buffer.from(parts[5], 'base64url');
    const powerOfTwo = N > 1 && (N & (N - 1)) === 0;
    if (!powerOfTwo || N > MAX_N || !(r >= 1 && r <= MAX_R) || !(p >= 1 && p <= MAX_P)) return null;
    if (salt.length === 0 || key.length === 0 || key.length > MAX_KEY_BYTES) return null;
    return { N, r, p, salt, key };
};

export const isSupportedPasswordHash = (stored: string): boolean => parseScrypt(stored) !== null;

export const verifyPassword = async (password: string, stored: string): Promise<boolean> => {
    const parsed = parseScrypt(stored);
    if (!parsed) {
        console.warn('[visualizer-server] unsupported or malformed password hash in story.json');
        return false;
    }
    const { N, r, p, salt, key } = parsed;
    const candidate = await scryptAsync(password, salt, key.length, optionsFor(N, r, p));
    return timingSafeEqual(candidate, key);
};
