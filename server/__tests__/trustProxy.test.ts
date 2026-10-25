import { afterEach, describe, expect, it } from 'vitest';
import { clientAddress, type TClientRequest } from '../src/auth/LoginLimiter';
import { parseEnv } from '../src/config/env';
import { EXAMPLE_PASSWORD, requestJson } from './helpers/http';
import { createTestApp, seedStory, type TTestApp } from './helpers/testApp';

const request = (remoteAddress: string, xff?: string | string[]): TClientRequest => ({
    headers: xff === undefined ? {} : { 'x-forwarded-for': xff },
    socket: { remoteAddress },
});

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

describe('TRUST_PROXY', () => {
    it('is on only for TRUST_PROXY=1', () => {
        expect(parseEnv({}).TRUST_PROXY).toBe(false);
        expect(parseEnv({ TRUST_PROXY: '0' }).TRUST_PROXY).toBe(false);
        expect(parseEnv({ TRUST_PROXY: 'true' }).TRUST_PROXY).toBe(false);
        expect(parseEnv({ TRUST_PROXY: ' 1 ' }).TRUST_PROXY).toBe(true);
    });
});

describe('login limiter behind a proxy', () => {
    let app: TTestApp | undefined;

    afterEach(async () => {
        await app?.close();
        app = undefined;
    });

    const failTenTimes = async (trustProxy: boolean) => {
        app = await createTestApp({ auth: { trustProxy } });
        await seedStory(app.app, 'secret', { public: false });
        const loginFrom = (forwardedFor: string, password: string) =>
            requestJson(`${app?.base}/api/stories/secret/login`, 'POST', {
                body: { password },
                headers: { 'x-forwarded-for': forwardedFor },
            });
        for (let i = 0; i < 10; i++) expect((await loginFrom('203.0.113.7', 'wrong')).status).toBe(401);
        expect((await loginFrom('203.0.113.7', EXAMPLE_PASSWORD)).status).toBe(429);
        return (await loginFrom('198.51.100.1', EXAMPLE_PASSWORD)).status;
    };

    it('keys by the forwarded client with TRUST_PROXY', async () => {
        expect(await failTenTimes(true)).toBe(204);
    }, 30_000);

    it('ignores X-Forwarded-For without TRUST_PROXY', async () => {
        expect(await failTenTimes(false)).toBe(429);
    }, 30_000);
});
