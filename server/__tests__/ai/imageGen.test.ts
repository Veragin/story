import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AI_SSE_EVENT, RIFF_SIGNATURE, WEBP_SIGNATURE } from '@story/protocol';
import sharp from 'sharp';
import { DataSource } from 'typeorm';
import { afterEach, describe, expect, it } from 'vitest';
import type { TGeneratedImage } from '../../aiLauncher/gemini/generateImage';
import { AiAvailability } from '../../src/ai/AiAvailability';
import { HttpError } from '../../src/common/HttpError';
import { AiCreditRepository } from '../../src/database/repositories/AiCreditRepository';
import { TEST_GEMINI_CONFIG, TEST_IMAGE_MODEL } from '../aiLauncher/fakeGemini';
import { FAKE_IMAGE_USAGE, FakeAgentConnection, generatedPng } from '../helpers/FakeAgentConnection';
import { login, requestJson, waitFor, type TAny } from '../helpers/http';
import { solidImage } from '../helpers/images';
import { openEventStream } from '../helpers/sse';
import { createTestApp, type TTestApp } from '../helpers/testApp';

let app: TTestApp | undefined;
let sessionsDir: string | undefined;
const streams: { close: () => void }[] = [];

afterEach(async () => {
    for (const stream of streams.splice(0)) stream.close();
    await app?.close();
    app = undefined;
    if (sessionsDir) await rm(sessionsDir, { recursive: true, force: true });
    sessionsDir = undefined;
});

const STORY = 'example';
const CREDITS_PER_IMAGE = 4;
const INTRO = 'village-thomas-intro';
const FOREST = 'village-thomas-forest';
const PALACE = 'kingdom-annie-palace';
const VISIT = 'kingdom-thomas-visit';
const FOREST_FILE = 'data/chapters/village/thomas.passages/forest.ts';

type TStartOptions = {
    enabled?: boolean;
    credits?: number;
    images?: boolean;
    agents?: boolean;
    imagesPerMinute?: number;
    maxReferences?: number;
};

const start = async ({
    enabled = true,
    credits = 100,
    images = true,
    agents = true,
    imagesPerMinute = 6,
    maxReferences = 2,
}: TStartOptions = {}) => {
    sessionsDir = await mkdtemp(path.join(tmpdir(), 'image-gen-sessions-'));
    const connection = new FakeAgentConnection(sessionsDir);
    connection.imageGeneration = images;
    if (!agents) connection.healthResult = { available: false, reason: 'no Claude' };
    const gemini = {
        ...TEST_GEMINI_CONFIG,
        imageModels: { [TEST_IMAGE_MODEL]: { creditsPerImage: CREDITS_PER_IMAGE, maxReferences } },
        maxPerStory: 2,
        imagesPerMinute,
    };
    const testApp = await createTestApp({ stories: [STORY], agentConnection: connection, ai: { sessionsDir, gemini } });
    app = testApp;
    if (enabled) await testApp.stories.setAiFeature(STORY, true);
    const creditRepo = testApp.app.get(AiCreditRepository);
    if (credits > 0) await creditRepo.topUp(STORY, credits);
    const cookie = await login(testApp.base, STORY);
    const storyBase = `${testApp.base}/api/stories/${STORY}`;
    const generate = (owner: string, id: string, body: unknown) =>
        requestJson(`${storyBase}/images/${owner}/${id}/generate`, 'POST', { body, headers: { cookie } });
    const upload = (owner: string, id: string, data: Buffer, version = '') =>
        requestJson(`${storyBase}/images/${owner}/${id}`, 'PUT', {
            body: { version, data: data.toString('base64') },
            headers: { cookie },
        });
    const getAi = () => requestJson(`${storyBase}/ai`, 'GET', { headers: { cookie } });
    const events = async () => {
        const stream = await openEventStream(`${storyBase}/ai/events`, { cookie });
        streams.push(stream);
        return () => stream.frames.filter((f) => f.event === AI_SSE_EVENT).map((f): TAny => f.data);
    };
    const imageVersion = async (owner: string, id: string): Promise<string> =>
        (await requestJson(`${storyBase}/images/${owner}/${id}`, 'GET', { headers: { cookie } })).body.version;
    const usageRows = () =>
        testApp.app
            .get(DataSource)
            .query(
                'SELECT kind, sessionId, model, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, ' +
                    'CAST(costMicroUsd AS CHAR) AS costMicroUsd, credits FROM story_ai_usage ORDER BY id'
            );
    const abs = (rel: string) => path.join(testApp.project(STORY).root, rel);
    return {
        testApp,
        connection,
        generate,
        upload,
        imageVersion,
        getAi,
        events,
        usageRows,
        abs,
        balance: () => creditRepo.balance(STORY),
    };
};

const isWebp = (bytes: Buffer) =>
    RIFF_SIGNATURE.every((b, i) => bytes[i] === b) && WEBP_SIGNATURE.every((b, i) => bytes[8 + i] === b);

const metadataOf = (base64: string) => sharp(Buffer.from(base64, 'base64')).metadata();

const generated = async (format: 'png' | 'jpeg' | 'webp'): Promise<TGeneratedImage> => ({
    mimeType: `image/${format}`,
    data: (await solidImage(format)).toString('base64'),
    usage: FAKE_IMAGE_USAGE,
});

type TDeferred = { promise: Promise<TGeneratedImage>; resolve: () => void; reject: (e: Error) => void };

const deferredImage = (): TDeferred => {
    let resolve: () => void = () => undefined;
    let reject: (e: Error) => void = () => undefined;
    const promise = new Promise<TGeneratedImage>((done, fail) => {
        resolve = () => {
            const answer = async () => done(await generatedPng());
            void answer();
        };
        reject = fail;
    });
    return { promise, resolve, reject };
};

describe('generateImage: checks', () => {
    it('validates the body first: owner story, a missing or too long prompt are 400', async () => {
        const { generate, connection } = await start({ enabled: false, credits: 0 });
        expect((await generate('passages', INTRO, { version: '' })).status).toBe(400);
        expect((await generate('passages', INTRO, { prompt: 'x' })).status).toBe(400);
        expect((await generate('passages', INTRO, { version: '', prompt: 'x', extra: 1 })).status).toBe(400);
        expect((await generate('passages', INTRO, { version: '', prompt: 'x'.repeat(4_001) })).status).toBe(400);
        expect((await generate('story', 'landing', { version: '', prompt: 'x' })).status).toBe(400);
        const disabled = await generate('passages', INTRO, { version: '', prompt: '' });
        expect([disabled.status, disabled.body.error]).toEqual([403, 'ai_disabled']);
        expect(connection.imageCalls).toEqual([]);
    });

    it('then image generation, credits and the rate limit, before the empty prompt', async () => {
        const { generate, connection, testApp } = await start({ credits: 0, imagesPerMinute: 2 });
        connection.imageGeneration = false;
        await testApp.app.get(AiAvailability).check();
        let res = await generate('passages', INTRO, { version: '', prompt: '' });
        expect([res.status, res.body.error]).toEqual([503, 'ai_unavailable']);

        connection.imageGeneration = true;
        await testApp.app.get(AiAvailability).check();
        res = await generate('passages', INTRO, { version: '', prompt: '' });
        expect([res.status, res.body.error]).toEqual([402, 'ai_no_credits']);

        await testApp.app.get(AiCreditRepository).topUp(STORY, 10);
        for (let i = 0; i < 2; i++) {
            res = await generate('passages', INTRO, { version: '', prompt: ' ' });
            expect([res.status, res.body.error]).toEqual([400, 'bad_request']);
        }
        res = await generate('passages', INTRO, { version: '', prompt: 'A forest' });
        expect([res.status, res.body.error]).toEqual([429, 'too_many_requests']);
        expect(connection.imageCalls).toEqual([]);
    });

    it('refuses an image link for passages only', async () => {
        const { generate, connection } = await start();
        const link = await generate('passages', INTRO, { version: '', prompt: '@../thomas.png' });
        expect([link.status, link.body.error]).toEqual([400, 'bad_request']);
        expect(link.body.message).toContain('image link');
        const character = await generate('characters', 'thomas', { version: '', prompt: '@foo in a hat' });
        expect(character.status, JSON.stringify(character.body)).toBe(200);
        expect(connection.imageCalls[0].request.prompt).toMatch(/^@foo in a hat\n\nStyle: a square portrait/);
    });

    it('an unknown owner is 404 and an unknown mention 422, both before generating and unpaid', async () => {
        const { generate, connection, balance } = await start();
        expect((await generate('characters', 'nobody', { version: '', prompt: 'Bob' })).status).toBe(404);
        const unknown = await generate('passages', INTRO, { version: '', prompt: '@character:bob waves' });
        expect([unknown.status, unknown.body.error]).toEqual([422, 'invalid']);
        expect(unknown.body.diagnostics[0]).toMatchObject({ field: 'prompt' });
        expect(connection.imageCalls).toEqual([]);
        expect(await balance()).toBe(100);
    });
});

describe('generateImage: mentions', () => {
    it('sends names and downscaled WebP references read from the story', async () => {
        const { generate, upload, connection } = await start();
        expect(
            (await upload('characters', 'thomas', await solidImage('png', { width: 2048, height: 1024 }))).status
        ).toBe(200);
        const prompt = '@character:thomas standing in @location:village, as in @passage:village-thomas-intro';
        const res = await generate('passages', PALACE, { version: '', prompt });
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        const [{ storyId, request }] = connection.imageCalls;
        expect(storyId).toBe(STORY);
        expect(request.model).toBe(TEST_IMAGE_MODEL);
        expect(request.prompt.split('\n\n')).toEqual([
            'Thomas standing in Village, as in Intro',
            'Image 1 is Thomas, a character. Keep their look.\nImage 2 is Intro, a scene. Keep its look.',
            expect.stringMatching(/^Style: /),
        ]);
        expect(request.references.map(({ label, mimeType }) => [label, mimeType])).toEqual([
            ['Thomas', 'image/webp'],
            ['Intro', 'image/webp'],
        ]);
        expect(await metadataOf(request.references[0].data)).toMatchObject({
            format: 'webp',
            width: 1024,
            height: 512,
        });
        expect(await metadataOf(request.references[1].data)).toMatchObject({ format: 'webp', width: 1024 });
    });

    it('uses the owner itself and a linked passage image, regular files only', async () => {
        const { generate, connection, abs, imageVersion } = await start({ maxReferences: 3 });
        const forest = await readFile(abs(FOREST_FILE), 'utf8');
        await writeFile(abs(FOREST_FILE), forest.replace(/image: '[^']*'/, "image: '@../../../assets/story.png'"));
        const prompt = `@passage:${INTRO} in the rain, like @passage:${FOREST}`;
        const res = await generate('passages', INTRO, { version: await imageVersion('passages', INTRO), prompt });
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        const [own, linked] = connection.imageCalls[0].request.references;
        expect([own.label, linked.label]).toEqual(['Intro', 'Forest']);
        expect(await metadataOf(own.data)).toMatchObject({ width: 1024, height: 1024 });
        expect(await metadataOf(linked.data)).toMatchObject({ width: 50, height: 50 });

        await symlink(abs('data/assets/story.png'), abs('data/assets/linked.png'));
        await writeFile(abs(FOREST_FILE), forest.replace(/image: '[^']*'/, "image: '@../../../assets/linked.png'"));
        expect((await generate('passages', PALACE, { version: '', prompt: `@passage:${FOREST}` })).status).toBe(200);
        expect(connection.imageCalls[1].request.references).toEqual([]);
        expect(connection.imageCalls[1].request.prompt).toMatch(/^Forest\n\nStyle: /);
    });

    it('refuses more referenced images than the model takes', async () => {
        const { generate, connection } = await start({ maxReferences: 1 });
        const res = await generate('passages', PALACE, {
            version: '',
            prompt: `@passage:${INTRO} and @passage:${FOREST}`,
        });
        expect([res.status, res.body.error]).toEqual([422, 'invalid']);
        expect(res.body.message).toContain('at most 1 referenced images');
        expect(connection.imageCalls).toEqual([]);
    });
});

describe('generateImage: storing and charging', () => {
    it('stores the image as WebP, charges it and sends the balance on the AI stream', async () => {
        const { generate, usageRows, balance, events, abs, imageVersion } = await start();
        const ai = await events();
        const res = await generate('passages', INTRO, {
            version: await imageVersion('passages', INTRO),
            prompt: 'A misty forest',
        });
        expect(res.status, JSON.stringify(res.body)).toBe(200);
        expect(res.body).toMatchObject({
            owner: 'passages',
            id: INTRO,
            file: 'data/chapters/village/thomas.passages/intro.webp',
            credits: 96,
        });
        expect(res.body.url).toContain(`?v=${res.body.version}`);
        expect(isWebp(await readFile(abs('data/chapters/village/thomas.passages/intro.webp')))).toBe(true);
        expect(existsSync(abs('data/chapters/village/thomas.passages/intro.png'))).toBe(false);
        expect(await balance()).toBe(96);
        expect(await usageRows()).toEqual([
            {
                kind: 'image',
                sessionId: null,
                model: TEST_IMAGE_MODEL,
                inputTokens: 300,
                outputTokens: 1290,
                cacheReadTokens: 0,
                cacheCreationTokens: 0,
                costMicroUsd: '40000',
                credits: 4,
            },
        ]);
        await waitFor(() => ai().some((event) => event.type === 'credits'));
        expect(ai().filter((event) => event.type === 'credits')).toEqual([{ type: 'credits', credits: 96 }]);
    });

    it('converts a JPEG to WebP and keeps a WebP as it is', async () => {
        const { generate, connection, abs } = await start();
        connection.respondImage = () => generated('jpeg');
        expect((await generate('characters', 'thomas', { version: '', prompt: 'Thomas' })).status).toBe(200);
        expect(isWebp(await readFile(abs('data/characters/thomas.webp')))).toBe(true);

        const webp = await generated('webp');
        connection.respondImage = () => Promise.resolve(webp);
        expect((await generate('npcs', 'franta', { version: '', prompt: 'Franta' })).status).toBe(200);
        expect((await readFile(abs('data/npcs/Franta.webp'))).equals(Buffer.from(webp.data, 'base64'))).toBe(true);

        connection.respondImage = () => Promise.resolve({ ...webp, data: Buffer.from('GIF89a').toString('base64') });
        const gif = await generate('locations', 'village', { version: '', prompt: 'Village' });
        expect([gif.status, gif.body.error]).toEqual([502, 'ai_image_failed']);
    });

    it('a failed generation is not charged', async () => {
        const { generate, connection, balance, usageRows } = await start();
        connection.respondImage = () => Promise.reject(HttpError.of('ai_image_failed', 'Gemini returned no image'));
        const res = await generate('characters', 'thomas', { version: '', prompt: 'Thomas' });
        expect([res.status, res.body]).toEqual([
            502,
            { error: 'ai_image_failed', message: 'Gemini returned no image' },
        ]);
        expect(await balance()).toBe(100);
        expect(await usageRows()).toEqual([]);
    });

    it('a stale version after generating is still charged', async () => {
        const { generate, balance, usageRows, connection } = await start();
        const res = await generate('passages', INTRO, { version: '', prompt: 'A misty forest' });
        expect([res.status, res.body.error]).toEqual([409, 'stale']);
        expect(res.body.current.version).not.toBe('');
        expect(connection.imageCalls).toHaveLength(1);
        expect(await balance()).toBe(96);
        expect(await usageRows()).toHaveLength(1);
    });
});

describe('generateImage: busy', () => {
    it('one job per owner and at most maxPerStory per story, released when done or failed', async () => {
        const { generate, connection } = await start();
        const jobs: TDeferred[] = [];
        connection.respondImage = () => {
            const job = deferredImage();
            jobs.push(job);
            return job.promise;
        };
        const first = generate('characters', 'thomas', { version: '', prompt: 'Thomas' });
        await waitFor(() => jobs.length === 1);
        const sameOwner = await generate('characters', 'thomas', { version: '', prompt: 'Thomas again' });
        expect([sameOwner.status, sameOwner.body.error]).toEqual([409, 'ai_image_busy']);

        const second = generate('npcs', 'franta', { version: '', prompt: 'Franta' });
        await waitFor(() => jobs.length === 2);
        const third = await generate('passages', VISIT, { version: '', prompt: 'The palace' });
        expect([third.status, third.body.error]).toEqual([409, 'ai_image_busy']);

        jobs[0].resolve();
        jobs[1].reject(HttpError.of('ai_image_failed', 'Gemini returned no image'));
        expect((await first).status).toBe(200);
        expect((await second).status).toBe(502);

        connection.respondImage = generatedPng;
        expect((await generate('npcs', 'franta', { version: '', prompt: 'Franta' })).status).toBe(200);
        expect((await generate('passages', VISIT, { version: '', prompt: 'The palace' })).status).toBe(200);
    });
});

describe('generateImage without Claude', () => {
    it('getAi reports images and the blocked AI stream still gets the credits event', async () => {
        const { generate, getAi, events } = await start({ agents: false });
        expect((await getAi()).body).toMatchObject({ available: false, imageGeneration: true, status: 'unavailable' });
        const ai = await events();
        await waitFor(() => ai().length === 2);
        expect((await generate('characters', 'thomas', { version: '', prompt: 'Thomas' })).status).toBe(200);
        await waitFor(() => ai().length === 3);
        expect(ai()[2]).toEqual({ type: 'credits', credits: 96 });
    });
});
