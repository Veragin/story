import type { IncomingMessage } from 'node:http';
import { describe, expect, it } from 'vitest';
import { clientAddress, trustProxyFromEnv } from '../src/auth/LoginLimiter';

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
