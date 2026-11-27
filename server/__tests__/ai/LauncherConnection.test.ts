import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AgentProcesses } from '../../aiLauncher/AgentProcesses';
import type { TAiTokenKind } from '../../aiLauncher/aiToken';
import { createLauncherServer, type TLauncherGemini } from '../../aiLauncher/launcherServer';
import { ndjsonLines } from '../../aiLauncher/ndjson';
import {
    healthOf,
    imageTimeoutOf,
    LauncherConnection,
    LauncherError,
    TRANSCRIPTS_FOLDER,
} from '../../src/ai/agentConnection/LauncherConnection';
import type { TAgentStream } from '../../src/ai/agentConnection/TAgentConnection';
import { isHttpError, type HttpError } from '../../src/common/HttpError';
import { sleep, waitFor } from '../helpers/http';
import { FakeDriver } from '../aiLauncher/fakeAgent';
import { FakeGemini, PNG_BASE64, TEST_GEMINI_CONFIG, TEST_IMAGE_MODEL } from '../aiLauncher/fakeGemini';

const KEY = 'launcher-key';

let dir: string;
let keyFile: string;
let server: Server | undefined;
let driver: FakeDriver;

beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'launcher-conn-'));
    keyFile = path.join(dir, 'key');
    await writeFile(keyFile, `${KEY}\n`);
});

afterEach(async () => {
    const running = server;
    server = undefined;
    if (running) {
        running.closeAllConnections();
        await new Promise((resolve) => running.close(resolve));
    }
    await rm(dir, { recursive: true, force: true });
});

const listen = async (http: Server): Promise<string> => {
    server = http;
    await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
    const address: AddressInfo | string | null = http.address();
    if (typeof address !== 'object' || address === null) throw new Error('no port');
    return `http://127.0.0.1:${address.port}`;
};

const startLauncher = async (tokenKind: TAiTokenKind | null = 'api_key', gemini?: TLauncherGemini) => {
    driver = new FakeDriver();
    const processes = new AgentProcesses(driver, { removeAfterMs: 10_000, stderrTailBytes: 4096 }, () => undefined);
    return await listen(
        createLauncherServer({
            key: KEY,
            tokenKind,
            driver,
            processes,
            limits: { models: ['claude-sonnet-5-5'], maxBudgetUsd: 5 },
            gemini,
            log: () => undefined,
        })
    );
};

const connect = (url: string, requireApiKey = false, imageTimeoutMs = 2000) =>
    new LauncherConnection({
        url,
        keyFile,
        sessionsDir: '/app/ai-sessions',
        requireApiKey,
        requestTimeoutMs: 2000,
        imageTimeoutMs,
    });

const collect = async (stream: TAgentStream): Promise<string[]> => {
    const lines: string[] = [];
    for await (const line of stream.lines) lines.push(line);
    return lines;
};

const httpError = async (task: Promise<unknown>): Promise<HttpError> => {
    try {
        await task;
    } catch (e) {
        if (isHttpError(e)) return e;
        throw e;
    }
    throw new Error('expected an HttpError');
};

const refusal = async (task: Promise<unknown>): Promise<LauncherError> => {
    try {
        await task;
    } catch (e) {
        if (e instanceof LauncherError) return e;
        throw e;
    }
    throw new Error('expected a launcher refusal');
};

describe('LauncherConnection against the launcher server', () => {
    it('reports health and its reasons', async () => {
        const url = await startLauncher('api_key');
        expect(await connect(url).health()).toEqual({ agents: { available: true }, imageGeneration: false });
        driver.healthResult = { docker: null, image: true };
        expect((await connect(url).health()).agents).toEqual({
            available: false,
            reason: 'The AI launcher cannot reach Docker',
        });
        driver.healthResult = { docker: '27.0.1', image: false };
        expect((await connect(url).health()).agents).toMatchObject({ reason: 'The agent image is missing' });
        await writeFile(keyFile, 'wrong');
        expect(await connect(url).health()).toEqual({
            agents: { available: false, reason: 'The AI launcher answered 401 unauthorized' },
            imageGeneration: false,
        });
    });

    it('a subscription token is not enough in production', async () => {
        const url = await startLauncher('oauth');
        expect((await connect(url).health()).agents).toEqual({ available: true });
        expect((await connect(url, true).health()).agents).toEqual({
            available: false,
            reason: 'Production needs an Anthropic API key, not a subscription token',
        });
    });

    it('no token, no key file, no launcher: unavailable', async () => {
        const url = await startLauncher(null);
        expect((await connect(url).health()).agents).toMatchObject({
            reason: 'The AI launcher has no Anthropic token',
        });
        const unreachable = await connect('http://127.0.0.1:1').health();
        expect(unreachable).toEqual({
            agents: { available: false, reason: expect.stringContaining('unreachable') },
            imageGeneration: false,
        });
        await rm(keyFile);
        expect((await connect(url).health()).agents.available).toBe(false);
        await expect(connect(url).open({ storyId: 'demo', maxBudgetUsd: 1 })).rejects.toThrow(/key file .* missing/);
    });

    it('opens an agent stream: started handle, both directions, interrupt and exit', async () => {
        const url = await startLauncher();
        const stream = await connect(url).open({ storyId: 'demo', maxBudgetUsd: 2, model: 'claude-sonnet-5-5' });
        expect(stream.handle).toEqual({ containerName: 'story-ai-demo-1', pid: 4242 });
        expect(driver.requests).toEqual([{ storyId: 'demo', maxBudgetUsd: 2, model: 'claude-sonnet-5-5' }]);
        const child = driver.lastChild();
        const lines = collect(stream);

        await stream.send('{"type":"user","message":{"role":"user","content":"hi"}}');
        const stdin = ndjsonLines(child.stdin)[Symbol.asyncIterator]();
        expect((await stdin.next()).value).toBe('{"type":"user","message":{"role":"user","content":"hi"}}');
        await stream.interrupt();
        await waitFor(() => child.signals.includes('SIGINT'));

        child.stdout.write('{"type":"system","subtype":"init","session_id":"s1"}\n{"type":"res');
        child.stdout.write('ult","total_cost_usd":0.1}\n');
        child.stderr.write('bye\n');
        child.exit(3);
        expect(await lines).toEqual([
            '{"type":"system","subtype":"init","session_id":"s1"}',
            '{"type":"result","total_cost_usd":0.1}',
        ]);
        expect(await stream.exited).toEqual({ code: 3, stderrTail: 'bye\n' });
    });

    it('close() makes the launcher stop the agent', async () => {
        const url = await startLauncher();
        const stream = await connect(url).open({ storyId: 'demo', maxBudgetUsd: 1 });
        const lines = collect(stream);
        const child = driver.lastChild();
        stream.close();
        await waitFor(() => child.signals.includes('SIGTERM'));
        child.exit(143);
        expect(await lines).toEqual([]);
        expect((await stream.exited).code).toBe(143);
    });

    it('turns refusals into LauncherErrors', async () => {
        const url = await startLauncher();
        const tooMuch = await refusal(connect(url).open({ storyId: 'demo', maxBudgetUsd: 6 }));
        expect([tooMuch.status, tooMuch.code]).toEqual([400, 'bad_request']);
        driver.failSpawn = new Error('spawn docker ENOENT');
        const failed = await refusal(connect(url).open({ storyId: 'demo', maxBudgetUsd: 1 }));
        expect([failed.status, failed.code, failed.message]).toEqual([
            500,
            'spawn_failed',
            'The AI launcher answered 500 spawn_failed: spawn docker ENOENT',
        ]);
    });

    it('answers 503 without a token', async () => {
        const url = await startLauncher(null);
        const refused = await refusal(connect(url).open({ storyId: 'demo', maxBudgetUsd: 1 }));
        expect([refused.status, refused.code]).toEqual([503, 'token_unavailable']);
    });

    it('cleanupAll removes every agent', async () => {
        const url = await startLauncher();
        driver.orphans = 2;
        expect(await connect(url).cleanupAll()).toBe(2);
        expect(driver.calls).toContain('cleanup');
    });

    it('places transcripts in the sessions volume under the container workdir name', () => {
        expect(TRANSCRIPTS_FOLDER).toBe('-repo-stories-story');
        expect(connect('http://x').layout('demo')).toEqual({
            storyRoot: '/repo/stories/story',
            sessionsRoot: '/app/ai-sessions/demo',
            transcriptsDir: '/app/ai-sessions/demo/-repo-stories-story',
        });
    });
});

describe('LauncherConnection framing', () => {
    // a minimal launcher that answers the upgrade and its first lines in one packet, then drops the connection
    const rawLauncher = () => {
        const http = createServer();
        http.on('upgrade', (_req, socket) => {
            socket.write(
                'HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: story-ai-agent\r\n\r\n' +
                    '{"type":"launcher","event":"started","containerName":"story-ai-x-1","pid":7}\n' +
                    '{"type":"assistant","message":{"content":[]}}\n{"type":"launcher","event":"other"}\n'
            );
            setTimeout(() => socket.destroy(), 20);
        });
        return http;
    };

    it('reads lines that arrive with the 101, and reports a lost connection', async () => {
        const url = await listen(rawLauncher());
        const stream = await connect(url).open({ storyId: 'demo', maxBudgetUsd: 1 });
        expect(stream.handle).toEqual({ containerName: 'story-ai-x-1', pid: 7 });
        expect(await collect(stream)).toEqual(['{"type":"assistant","message":{"content":[]}}']);
        expect(await stream.exited).toEqual({ code: null, stderrTail: 'The connection to the AI launcher was lost' });
    });

    it('rejects a stream that does not start with the started line', async () => {
        const http = createServer();
        http.on('upgrade', (_req, socket) => {
            socket.end(
                'HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: story-ai-agent\r\n\r\n{}\n'
            );
        });
        const url = await listen(http);
        await expect(connect(url).open({ storyId: 'demo', maxBudgetUsd: 1 })).rejects.toThrow(
            'The AI launcher did not report a started agent'
        );
    });
});

const LAUNCHER_HEALTH = { docker: '27.0.1', image: true, token: 'api_key', driver: 'docker-run' };

const GENERATION = {
    model: TEST_IMAGE_MODEL,
    prompt: 'Thomas in the village',
    references: [{ label: 'Thomas', mimeType: 'image/png' as const, data: PNG_BASE64 }],
};

describe('health split', () => {
    it('images work without Claude', () => {
        expect(
            healthOf({ docker: null, image: false, token: null, gemini: true, imageModels: [TEST_IMAGE_MODEL] }, true)
        ).toEqual({
            agents: { available: false, reason: 'The AI launcher cannot reach Docker' },
            imageGeneration: true,
        });
    });

    it('Claude works without images', () => {
        expect(healthOf({ ...LAUNCHER_HEALTH, gemini: false, imageModels: [TEST_IMAGE_MODEL] }, true)).toEqual({
            agents: { available: true },
            imageGeneration: false,
        });
        expect(healthOf({ ...LAUNCHER_HEALTH, gemini: true, imageModels: [] }, true).imageGeneration).toBe(false);
        expect(healthOf({ ...LAUNCHER_HEALTH }, true).imageGeneration).toBe(false);
        expect(healthOf(null, true).imageGeneration).toBe(false);
    });

    it('a launcher with a Gemini key and no Anthropic token offers images only', async () => {
        const url = await startLauncher(null, { client: new FakeGemini(), config: TEST_GEMINI_CONFIG });
        expect(await connect(url).health()).toEqual({
            agents: { available: false, reason: 'The AI launcher has no Anthropic token' },
            imageGeneration: true,
        });
    });
});

describe('LauncherConnection.generateImage', () => {
    it('waits the Gemini timeout plus a margin, not the default request timeout', () => {
        expect(imageTimeoutOf(120_000)).toBe(135_000);
    });

    it('posts the request to the launcher and returns its image', async () => {
        const gemini = new FakeGemini();
        const url = await startLauncher(null, { client: gemini, config: TEST_GEMINI_CONFIG });
        expect(await connect(url).generateImage('demo', GENERATION)).toEqual({
            mimeType: 'image/png',
            data: PNG_BASE64,
            usage: { promptTokens: 300, candidatesTokens: 1290, totalTokens: 1590 },
        });
        expect(gemini.calls[0]).toMatchObject({
            model: TEST_IMAGE_MODEL,
            contents: [
                {
                    parts: [
                        { text: 'Thomas in the village' },
                        { inlineData: { mimeType: 'image/png', data: PNG_BASE64 } },
                    ],
                },
            ],
        });
    });

    it('maps a refused image to ai_image_failed and a missing key to ai_unavailable', async () => {
        const gemini = new FakeGemini();
        gemini.answerWith({ candidates: [{ content: { parts: [{ text: 'I cannot draw that' }] } }] });
        const url = await startLauncher(null, { client: gemini, config: TEST_GEMINI_CONFIG });
        const failed = await httpError(connect(url).generateImage('demo', GENERATION));
        expect([failed.status, failed.body]).toEqual([
            502,
            { error: 'ai_image_failed', message: 'Gemini returned no image: I cannot draw that' },
        ]);

        const noKey = await startLauncher(null);
        const unavailable = await httpError(connect(noKey).generateImage('demo', GENERATION));
        expect([unavailable.status, unavailable.body.error]).toEqual([503, 'ai_unavailable']);
    });

    // a launcher stub that answers /images with the given status and body after `delayMs`
    const imagesStub = (status: number, body: unknown, delayMs = 0) =>
        createServer((_req, res) => {
            const answer = async () => {
                await sleep(delayMs);
                res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
            };
            void answer();
        });

    it('maps the launcher answers 429, 503, 504 and an unreadable image', async () => {
        const cases: [number, unknown, number, string, string][] = [
            [429, { error: 'too_many_requests' }, 429, 'too_many_requests', expect.any(String)],
            [
                503,
                { error: 'gemini_unavailable', message: 'quota' },
                503,
                'ai_unavailable',
                expect.stringContaining('quota'),
            ],
            [504, { error: 'timeout', message: 'slow' }, 502, 'ai_image_failed', 'Generating took too long'],
            [200, { mimeType: 'image/png' }, 502, 'ai_image_failed', 'The AI launcher sent an unreadable image'],
        ];
        for (const [launcherStatus, body, status, error, message] of cases) {
            const url = await listen(imagesStub(launcherStatus, body));
            const e = await httpError(connect(url).generateImage('demo', GENERATION));
            expect([e.status, e.body.error, e.body.message]).toEqual([status, error, message]);
            await new Promise((resolve) => server?.close(resolve));
        }
    });

    it('gives up after the image timeout with "Generating took too long"', async () => {
        const url = await listen(imagesStub(200, {}, 5_000));
        const started = Date.now();
        const e = await httpError(connect(url, false, 150).generateImage('demo', GENERATION));
        expect([e.status, e.body.error, e.body.message]).toEqual([502, 'ai_image_failed', 'Generating took too long']);
        expect(Date.now() - started).toBeLessThan(2000);
    });

    it('uses the image timeout, which outlasts the request timeout', async () => {
        const image = {
            mimeType: 'image/png',
            data: PNG_BASE64,
            usage: { promptTokens: 1, candidatesTokens: 2, totalTokens: 3 },
        };
        const url = await listen(imagesStub(200, image, 300));
        const slowImages = new LauncherConnection({
            url,
            keyFile,
            sessionsDir: '/app/ai-sessions',
            requireApiKey: false,
            requestTimeoutMs: 50,
            imageTimeoutMs: 2000,
        });
        expect(await slowImages.generateImage('demo', GENERATION)).toEqual(image);
    });

    it('an unreachable launcher is ai_unavailable', async () => {
        const e = await httpError(connect('http://127.0.0.1:1').generateImage('demo', GENERATION));
        expect([e.status, e.body.error]).toEqual([503, 'ai_unavailable']);
    });
});
