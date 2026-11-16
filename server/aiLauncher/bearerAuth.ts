import { createHash, timingSafeEqual } from 'node:crypto';

const BEARER = /^Bearer\s+(\S+)\s*$/i;

const digest = (value: string) => createHash('sha256').update(value).digest();

export const isBearerAuthorized = (header: string | undefined, key: string): boolean => {
    const presented = BEARER.exec(header ?? '')?.[1] ?? '';
    // compare fixed-length digests so neither the key's length nor its prefix leaks through timing
    return timingSafeEqual(digest(presented), digest(key));
};
