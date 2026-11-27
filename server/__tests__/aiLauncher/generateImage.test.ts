import { ApiError } from '@google/genai';
import { describe, expect, it } from 'vitest';
import { generateImage, type TImageGeneration } from '../../aiLauncher/gemini/generateImage';
import { ImageGenerationError } from '../../aiLauncher/gemini/ImageGenerationError';
import { FakeGemini, PNG_BASE64, TEST_IMAGE_MODEL, untilAborted, WEBP_BASE64 } from './fakeGemini';

const REQUEST: TImageGeneration = {
    model: TEST_IMAGE_MODEL,
    prompt: 'Thomas in the Village',
    references: [
        { label: 'Thomas', mimeType: 'image/png', data: PNG_BASE64 },
        { label: 'Village', mimeType: 'image/webp', data: WEBP_BASE64 },
    ],
};

const generate = (gemini: FakeGemini, signal = new AbortController().signal) => generateImage(gemini, REQUEST, signal);

const failureOf = async (gemini: FakeGemini, signal?: AbortSignal) => {
    try {
        await generate(gemini, signal);
    } catch (e) {
        if (e instanceof ImageGenerationError) return { kind: e.kind, message: e.message };
        throw e;
    }
    throw new Error('expected generateImage to fail');
};

describe('generateImage', () => {
    it('sends the prompt, then the references as inline data, for one square image', async () => {
        const gemini = new FakeGemini();
        const signal = new AbortController().signal;
        await generate(gemini, signal);
        expect(gemini.calls).toEqual([
            {
                model: TEST_IMAGE_MODEL,
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: 'Thomas in the Village' },
                            { inlineData: { mimeType: 'image/png', data: PNG_BASE64 } },
                            { inlineData: { mimeType: 'image/webp', data: WEBP_BASE64 } },
                        ],
                    },
                ],
                config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1' }, abortSignal: signal },
            },
        ]);
    });

    it('returns the first image part with the token usage', async () => {
        expect(await generate(new FakeGemini())).toEqual({
            mimeType: 'image/png',
            data: PNG_BASE64,
            usage: { promptTokens: 300, candidatesTokens: 1290, totalTokens: 1590 },
        });
    });

    it('skips thought images and defaults missing usage to zero', async () => {
        const gemini = new FakeGemini();
        gemini.answerWith({
            candidates: [
                {
                    content: {
                        parts: [
                            { thought: true, inlineData: { mimeType: 'image/png', data: 'draft' } },
                            { inlineData: { mimeType: 'image/webp', data: WEBP_BASE64 } },
                        ],
                    },
                },
            ],
        });
        expect(await generate(gemini)).toEqual({
            mimeType: 'image/webp',
            data: WEBP_BASE64,
            usage: { promptTokens: 0, candidatesTokens: 0, totalTokens: 0 },
        });
    });

    it('fails with image_failed and the scrubbed answer when there is no image part', async () => {
        const gemini = new FakeGemini();
        gemini.answerWith({
            candidates: [{ content: { parts: [{ text: '  I cannot\u0007 draw\n that.  ' }] }, finishReason: 'STOP' }],
        });
        expect(await failureOf(gemini)).toEqual({
            kind: 'image_failed',
            message: 'Gemini returned no image: I cannot draw that.',
        });
    });

    it('reports the finish reason of a safety block', async () => {
        const gemini = new FakeGemini();
        gemini.answerWith({ candidates: [{ finishReason: 'IMAGE_SAFETY' }] });
        expect(await failureOf(gemini)).toEqual({
            kind: 'image_failed',
            message: 'Gemini returned no image (IMAGE_SAFETY)',
        });
        gemini.answerWith({ promptFeedback: { blockReason: 'PROHIBITED_CONTENT' } });
        expect(await failureOf(gemini)).toMatchObject({ message: 'Gemini returned no image (PROHIBITED_CONTENT)' });
    });

    it('caps the length of the failure message', async () => {
        const gemini = new FakeGemini();
        gemini.answerWith({ candidates: [{ content: { parts: [{ text: 'no '.repeat(1000) }] } }] });
        const { message } = await failureOf(gemini);
        expect(message.length).toBe(500);
        expect(message.endsWith('…')).toBe(true);
    });

    it.each([
        [
            'a quota error',
            new ApiError({ status: 429, message: '{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}' }),
            'Gemini quota exhausted',
        ],
        [
            'an outage',
            new ApiError({ status: 503, message: '{"error":{"code":503,"message":"overloaded"}}' }),
            'Gemini is unavailable: overloaded',
        ],
        ['a network failure', new TypeError('fetch failed'), 'Gemini is unavailable: fetch failed'],
    ])('maps %s to unavailable', async (_, error, message) => {
        const gemini = new FakeGemini();
        gemini.failWith(error);
        expect(await failureOf(gemini)).toEqual({ kind: 'unavailable', message: expect.stringContaining(message) });
    });

    it('maps a rejected request to image_failed with the API message', async () => {
        const gemini = new FakeGemini();
        gemini.failWith(
            new ApiError({
                status: 400,
                message: '{"error":{"code":400,"message":"Unable to process input image"}}',
            })
        );
        expect(await failureOf(gemini)).toEqual({
            kind: 'image_failed',
            message: 'Gemini refused: Unable to process input image',
        });
    });

    it('fails with aborted when the signal fires', async () => {
        const gemini = new FakeGemini();
        gemini.respond = untilAborted;
        const controller = new AbortController();
        const failure = failureOf(gemini, controller.signal);
        controller.abort();
        expect(await failure).toMatchObject({ kind: 'aborted' });
    });
});
