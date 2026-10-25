import { PASSWORD_RESET_TOKEN_PARAM } from '@story/protocol';
import { DataSource } from 'typeorm';
import { afterEach, describe, expect, it } from 'vitest';
import { hashToken } from '../src/auth/SessionService';
import { StoryPasswordResetRepository } from '../src/database/repositories/StoryPasswordResetRepository';
import { cookieOf, EXAMPLE_PASSWORD, login, requestJson } from './helpers/http';
import { createTestApp, TEST_PUBLIC_URL, type TTestApp } from './helpers/testApp';

const EMAIL = 'Me@Example.com';
const NEW_PASSWORD = 'new-secret';

let app: TTestApp | undefined;

afterEach(async () => {
    await app?.close();
    app = undefined;
});

const start = async () => {
    const testApp = await createTestApp({
        stories: [{ id: 'alpha', email: EMAIL }, 'beta', { id: 'gamma', email: EMAIL }],
    });
    app = testApp;
    const url = (storyId: string) => `${testApp.base}/api/stories/${storyId}/password-reset`;
    const request = (email: unknown, storyId = 'alpha') => requestJson(url(storyId), 'POST', { body: { email } });
    const reset = (token: string, password = NEW_PASSWORD, { storyId = 'alpha' } = {}) =>
        requestJson(url(storyId), 'PUT', { body: { token, password } });
    const canEdit = async (cookie: string, storyId = 'alpha') =>
        (await requestJson(`${testApp.base}/api/stories/${storyId}/access`, 'GET', { headers: { cookie } })).body
            .canEdit;
    const rows = (): Promise<{ storyId: string; tokenHash: string }[]> =>
        testApp.app.get(DataSource).query('SELECT storyId, tokenHash FROM story_password_reset ORDER BY storyId');
    const lastToken = () => {
        const link = testApp.mailer.sent.at(-1)?.text.match(/https?:\/\/\S+/)?.[0];
        if (!link) throw new Error('no reset link was mailed');
        const token = new URL(link).searchParams.get(PASSWORD_RESET_TOKEN_PARAM);
        if (!token) throw new Error(`no token in ${link}`);
        return token;
    };
    return { testApp, request, reset, canEdit, rows, lastToken };
};

describe('requestPasswordReset', () => {
    it('answers a wrong email, or a story without one, with 204 after the delay, and mails nothing', async () => {
        const { testApp, request, rows } = await start();
        expect((await request('other@example.com')).status).toBe(204);
        expect(testApp.wrongEmailDelays()).toBe(1);
        expect((await request('anyone@example.com', 'beta')).status).toBe(204);
        expect(testApp.wrongEmailDelays()).toBe(2);
        expect(testApp.mailer.sent).toEqual([]);
        expect(await rows()).toEqual([]);
    });

    it('validates the body and the story', async () => {
        const { testApp, request } = await start();
        expect((await request('')).status).toBe(400);
        expect((await request(42)).status).toBe(400);
        expect((await request(EMAIL, 'missing')).status).toBe(404);
        expect(testApp.mailer.sent).toEqual([]);
    });

    it('mails a link with the story and a token to a matching email; the row keeps only its hash', async () => {
        const { testApp, request, rows, lastToken } = await start();
        const res = await request('  me@EXAMPLE.com ');
        expect(res.status).toBe(204);
        expect(testApp.wrongEmailDelays()).toBe(0);
        expect(testApp.mailer.sent).toHaveLength(1);
        const [mail] = testApp.mailer.sent;
        expect(mail.to).toBe(EMAIL);
        expect(mail.text).toContain('12 hours');
        const token = lastToken();
        expect(mail.text).toContain(`${TEST_PUBLIC_URL}/?story=alpha&${PASSWORD_RESET_TOKEN_PARAM}=${token}`);
        expect(await rows()).toEqual([{ storyId: 'alpha', tokenHash: hashToken(token) }]);
        expect(JSON.stringify(await rows())).not.toContain(token);
    });

    it('a newer request replaces the token: only the newest link works', async () => {
        const { request, reset, rows, lastToken } = await start();
        await request(EMAIL);
        const first = lastToken();
        await request(EMAIL);
        const second = lastToken();
        expect(second).not.toBe(first);
        expect(await rows()).toHaveLength(1);
        expect((await reset(first)).status).toBe(400);
        expect((await reset(second)).status).toBe(204);
    });

    it('answers 500 when the mail cannot be sent', async () => {
        const { testApp, request } = await start();
        testApp.mailer.failure = new Error('SMTP down');
        const res = await request(EMAIL);
        expect([res.status, res.body.error]).toEqual([500, 'internal']);
        expect(res.body.message).not.toContain('SMTP');
    });

    it('allows 5 requests per IP and story in the window, right or wrong', async () => {
        const { testApp, request } = await start();
        for (const email of ['a@example.com', EMAIL, 'b@example.com', EMAIL, 'c@example.com']) {
            expect((await request(email)).status).not.toBe(429);
        }
        const blocked = await request(EMAIL);
        expect([blocked.status, blocked.body.error]).toEqual([429, 'too_many_requests']);
        expect(testApp.mailer.sent).toHaveLength(2);
        expect((await request('x@example.com', 'beta')).status).toBe(204);
    });
});

describe('resetPassword', () => {
    it('sets the password, logs out everyone else, logs the resetting browser in, and burns the token', async () => {
        const { testApp, request, reset, canEdit, lastToken } = await start();
        const other = await login(testApp.base, 'alpha');
        const otherBeta = await login(testApp.base, 'beta', { cookie: other });
        await request(EMAIL);
        const token = lastToken();

        const res = await reset(token);
        expect(res.status).toBe(204);
        const cookie = cookieOf(res);
        expect(cookie).toMatch(/^story_session=/);
        expect(await canEdit(cookie)).toBe(true);

        expect(await canEdit(other)).toBe(false);
        expect(await canEdit(otherBeta, 'beta')).toBe(true);
        await expect(login(testApp.base, 'alpha', { password: EXAMPLE_PASSWORD })).rejects.toThrow('401');
        expect(await login(testApp.base, 'alpha', { password: NEW_PASSWORD })).toMatch(/^story_session=/);
        expect((await testApp.stories.readVersioned('alpha'))?.version).toBe('2');

        const again = await reset(token, 'another-secret');
        expect([again.status, again.body.message]).toEqual([400, 'The link is invalid or has expired']);
    });

    it('refuses an expired token, a token of another story and an invalid password', async () => {
        const { testApp, request, reset, lastToken } = await start();
        const resets = testApp.app.get(StoryPasswordResetRepository);
        await resets.replace('alpha', hashToken('expired-token'), new Date(Date.now() - 1));
        expect((await reset('expired-token')).status).toBe(400);

        await request(EMAIL, 'gamma');
        const gammaToken = lastToken();
        expect((await reset(gammaToken)).status).toBe(400);
        expect((await reset(gammaToken, 'short', { storyId: 'gamma' })).status).toBe(400);
        expect((await reset('', NEW_PASSWORD, { storyId: 'gamma' })).status).toBe(400);
        expect((await reset(gammaToken, NEW_PASSWORD, { storyId: 'gamma' })).status).toBe(204);
        await expect(login(testApp.base, 'alpha', { password: NEW_PASSWORD })).rejects.toThrow('401');
    });

    it('prunes expired reset rows with the sessions', async () => {
        const { testApp, rows } = await start();
        const resets = testApp.app.get(StoryPasswordResetRepository);
        await resets.replace('alpha', hashToken('old'), new Date(Date.now() - 1));
        await resets.replace('beta', hashToken('live'), new Date(Date.now() + 60_000));
        await testApp.sessions.prune();
        expect((await rows()).map((row) => row.storyId)).toEqual(['beta']);
    });
});
