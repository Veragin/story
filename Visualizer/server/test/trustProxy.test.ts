import type { IncomingMessage } from 'node:http';
import { describe, expect, it } from 'vitest';
import { clientAddress, trustProxyFromEnv } from '../src/auth/LoginLimiter';

/**
 * `TRUST_PROXY` (multiple stories, phase 11): behind the production Caddy the login limiter keys on
 * the last `X-Forwarded-For` hop, the one the proxy wrote, never on a hop the client could send.
 */
const request = (remoteAddress: string, xff?: string | string[]) =>
    ({
        headers: xff === undefined ? {} : { 'x-forwarded-for': xff },
        socket: { remoteAddress },
    }) as unknown as IncomingMessage;

describe('clientAddress', () => {
    it('is the socket peer without TRUST_PROXY, whatever the header says', () => {
        expect(clientAddress(request('10.0.0.2', '203.0.113.7'), false)).toBe('10.0.0.2');
    });

    it('is the last X-Forwarded-For hop with TRUST_PROXY', () => {
        expect(clientAddress(request('10.0.0.2', '203.0.113.7'), true)).toBe('203.0.113.7');
        // a client-sent first hop does not pick the key
        expect(clientAddress(request('10.0.0.2', '1.2.3.4, 203.0.113.7'), true)).toBe('203.0.113.7');
        expect(clientAddress(request('10.0.0.2', ['1.2.3.4', ' 203.0.113.7 ']), true)).toBe('203.0.113.7');
    });

    it('falls back to the socket peer when the header is missing or empty', () => {
        expect(clientAddress(request('10.0.0.2'), true)).toBe('10.0.0.2');
        expect(clientAddress(request('10.0.0.2', ' , '), true)).toBe('10.0.0.2');
    });
});

describe('trustProxyFromEnv', () => {
    it('is on only for TRUST_PROXY=1', () => {
        expect(trustProxyFromEnv({})).toBe(false);
        expect(trustProxyFromEnv({ TRUST_PROXY: '0' })).toBe(false);
        expect(trustProxyFromEnv({ TRUST_PROXY: 'true' })).toBe(false);
        expect(trustProxyFromEnv({ TRUST_PROXY: ' 1 ' })).toBe(true);
    });
});
