import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/**
 * Story passwords (multiple stories, plan D1). `story.json` stores a self-describing hash,
 *
 *     scrypt$<N>$<r>$<p>$<salt>$<hash>        salt and hash in base64url, salt = 16 random bytes
 *
 * so the parameters (or the whole scheme) can change later without breaking stories hashed
 * before. scrypt rather than the spec's plain SHA-2: it is deliberately slow and memory-hard, so a
 * leaked `story.json` is expensive to brute-force. It comes with `node:crypto`, no dependency.
 */

/** Parameters for new hashes: N = 2^14, r = 8, p = 1 (about 16 MB and tens of ms per hash). */
const DEFAULT_PARAMS = { N: 16384, r: 8, p: 1 };
const SALT_BYTES = 16;
const KEY_BYTES = 64;

/**
 * Upper bounds for a hash read from `story.json`. An imported story (phase 5) keeps its zip's
 * hash, so its parameters come from outside: without a cap, `N = 2^30` would make every login
 * attempt allocate gigabytes.
 */
const MAX_N = 2 ** 20;
const MAX_R = 32;
const MAX_P = 16;
const MAX_KEY_BYTES = 256;

const scryptAsync = (password: string, salt: Buffer, keylen: number, options: ScryptOptions) =>
    new Promise<Buffer>((resolve, reject) =>
        scrypt(password, salt, keylen, options, (err, key) => (err ? reject(err) : resolve(key)))
    );

/** scrypt needs 128·N·r bytes; Node's default `maxmem` (32 MB) would refuse the larger allowed N. */
const optionsFor = (N: number, r: number, p: number): ScryptOptions => ({ N, r, p, maxmem: 256 * N * r });

/** Hash a new password (story creation, a password change). */
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

/**
 * Whether a stored hash is one `verifyPassword` can check (the format, and parameters within the
 * caps). The zip import refuses a `story.json` whose hash is not, since nobody could ever unlock it.
 */
export const isSupportedPasswordHash = (stored: string): boolean => parseScrypt(stored) !== null;

/**
 * Whether `password` matches a stored hash. The comparison is constant-time (`timingSafeEqual`).
 * A malformed or unknown hash format never matches (and is logged, since it means a broken
 * `story.json`).
 */
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
