import { describe, expect, it } from 'vitest';
import { LocalConnection } from '../../src/ai/agentConnection/LocalConnection';
import { isHttpError, type HttpError } from '../../src/common/HttpError';
import { FakeGemini, PNG_BASE64, TEST_IMAGE_MODEL, untilAborted } from '../aiLauncher/fakeGemini';

const GENERATION = { model: TEST_IMAGE_MODEL, prompt: 'Thomas', references: [] };

const local = (client: FakeGemini | null, timeoutMs = 2000) =>
    new LocalConnection((storyId) => `/stories/${storyId}`, { client, timeoutMs });

const httpError = async (task: Promise<unknown>): Promise<HttpError> => {
    try {
        await task;
    } catch (e) {
        if (isHttpError(e)) return e;
        throw e;
    }
    throw new Error('expected an HttpError');
};

const statusError = (status: number, message: string) => Object.assign(new Error(message), { status });

describe('LocalConnection images (AI_SANDBOX=none)', () => {
    it('generates in-process with the GEMINI_API_KEY client', async () => {
        const gemini = new FakeGemini();
        expect(await local(gemini).generateImage('demo', GENERATION)).toEqual({
            mimeType: 'image/png',
            data: PNG_BASE64,
            usage: { promptTokens: 300, candidatesTokens: 1290, totalTokens: 1590 },
        });
        expect(gemini.calls).toHaveLength(1);
    });

    it('maps the Gemini errors like the launcher answers', async () => {
        const gemini = new FakeGemini();
        gemini.answerWith({ candidates: [{ content: { parts: [{ text: 'No' }] } }] });
        const refused = await httpError(local(gemini).generateImage('demo', GENERATION));
        expect([refused.status, refused.body.error]).toEqual([502, 'ai_image_failed']);

        gemini.failWith(statusError(429, 'RESOURCE_EXHAUSTED'));
        const quota = await httpError(local(gemini).generateImage('demo', GENERATION));
        expect([quota.status, quota.body.error]).toEqual([503, 'ai_unavailable']);

        gemini.respond = untilAborted;
        const slow = await httpError(local(gemini, 50).generateImage('demo', GENERATION));
        expect([slow.status, slow.body]).toEqual([
            502,
            { error: 'ai_image_failed', message: 'Generating took too long' },
        ]);

        const noKey = await httpError(local(null).generateImage('demo', GENERATION));
        expect([noKey.status, noKey.body.error]).toEqual([503, 'ai_unavailable']);
    });

    it('offers images only with a key', async () => {
        expect((await local(new FakeGemini()).health()).imageGeneration).toBe(true);
        expect((await local(null).health()).imageGeneration).toBe(false);
    });
});
