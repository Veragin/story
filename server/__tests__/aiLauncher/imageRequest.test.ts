import { IMAGE_PROMPT_MAX_LENGTH } from '@story/protocol';
import { describe, expect, it } from 'vitest';
import { MAX_REFERENCE_BYTES, parseImageRequest } from '../../aiLauncher/imageRequest';
import { PNG_BASE64, TEST_GEMINI_CONFIG, TEST_IMAGE_MODEL, WEBP_BASE64 } from './fakeGemini';

const reference = (mimeType: string, data: string, label = 'Thomas') => ({ label, mimeType, data });

const request = (overrides: Record<string, unknown> = {}) => ({
    storyId: 'demo',
    model: TEST_IMAGE_MODEL,
    prompt: 'Thomas standing in the middle of Village',
    references: [reference('image/png', PNG_BASE64), reference('image/webp', WEBP_BASE64, 'Village')],
    ...overrides,
});

const parse = (body: unknown) => parseImageRequest(body, TEST_GEMINI_CONFIG);

const failure = (body: unknown) => {
    const result = parse(body);
    if (result.ok) throw new Error('expected a validation failure');
    return result.message;
};

const oversizedPng = () => {
    const bytes = Buffer.alloc(MAX_REFERENCE_BYTES + 1);
    Buffer.from(PNG_BASE64, 'base64').copy(bytes);
    return bytes.toString('base64');
};

describe('parseImageRequest', () => {
    it('accepts a valid request', () => {
        expect(parse(request())).toEqual({ ok: true, request: request() });
    });

    it('accepts a request without references and trims the prompt', () => {
        expect(parse(request({ prompt: '  a castle  ', references: [] }))).toEqual({
            ok: true,
            request: request({ prompt: 'a castle', references: [] }),
        });
    });

    it.each([
        ['a bad story id', { storyId: '../x' }, 'storyId'],
        ['an unknown model', { model: 'gemini-other' }, 'must be one of gemini-test-image'],
        ['a blank prompt', { prompt: '   ' }, 'prompt'],
        ['a prompt over the limit', { prompt: 'x'.repeat(IMAGE_PROMPT_MAX_LENGTH + 1) }, 'prompt'],
        ['an unknown key', { mounts: ['/'] }, 'mounts'],
        [
            'too many references',
            {
                references: [
                    reference('image/png', PNG_BASE64),
                    reference('image/png', PNG_BASE64),
                    reference('image/png', PNG_BASE64),
                ],
            },
            'references',
        ],
        ['a jpeg reference', { references: [reference('image/jpeg', PNG_BASE64)] }, 'mimeType'],
        ['data that is not base64', { references: [reference('image/png', '%%not base64%%')] }, 'data'],
        [
            'data that is not an image',
            { references: [reference('image/png', Buffer.from('hello').toString('base64'))] },
            'is not a image/png image',
        ],
        [
            'a webp signature labeled png',
            { references: [reference('image/png', WEBP_BASE64)] },
            'is not a image/png image',
        ],
        [
            'a png signature labeled webp',
            { references: [reference('image/webp', PNG_BASE64)] },
            'is not a image/webp image',
        ],
        ['an oversized reference', { references: [reference('image/png', oversizedPng())] }, 'is over 1 MB'],
        ['a reference without a label', { references: [reference('image/png', PNG_BASE64, ' ')] }, 'label'],
        ['an unknown reference key', { references: [{ ...reference('image/png', PNG_BASE64), path: '/etc' }] }, 'path'],
    ])('rejects %s', (_, overrides, expected) => {
        expect(failure(request(overrides))).toContain(expected);
    });

    it('applies the reference limit of the requested model', () => {
        const limits = {
            imageModels: {
                [TEST_IMAGE_MODEL]: { creditsPerImage: 4, maxReferences: 2 },
                'gemini-single': { creditsPerImage: 2, maxReferences: 1 },
            },
        };
        expect(parseImageRequest(request(), limits).ok).toBe(true);
        const result = parseImageRequest(request({ model: 'gemini-single' }), limits);
        expect(result).toMatchObject({ ok: false, message: expect.stringContaining('at most 1 reference') });
    });
});
