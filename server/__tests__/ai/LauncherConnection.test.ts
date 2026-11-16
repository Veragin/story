import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AgentProcesses } from '../../aiLauncher/AgentProcesses';
import type { TAiTokenKind } from '../../aiLauncher/aiToken';
import { createLauncherServer } from '../../aiLauncher/launcherServer';
import { ndjsonLines } from '../../aiLauncher/ndjson';
import { LauncherConnection, LauncherError, TRANSCRIPTS_FOLDER } from '../../src/ai/agentConnection/LauncherConnection';
import type { TAgentStream } from '../../src/ai/agentConnection/TAgentConnection';
import { waitFor } from '../helpers/http';
import { FakeDriver } from '../aiLauncher/fakeAgent';

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

const startLauncher = async (tokenKind: TAiTokenKind | null = 'api_key') => {
    driver = new FakeDriver();
    const processes = new AgentProcesses(driver, { removeAfterMs: 10_000, stderrTailBytes: 4096 }, () => undefined);
    return await listen(
        createLauncherServer({
            key: KEY,
            tokenKind,
            driver,
            processes,
            limits: { models: ['claude-sonnet-5-5'], maxBudgetUsd: 5 },
            log: () => undefined,
        })
    );
};

const connect = (url: string, requireApiKey = false) =>
    new LauncherConnection({ url, keyFile, sessionsDir: '/app/ai-sessions', requireApiKey, requestTimeoutMs: 2000 });

const collect = async (stream: TAgentStream): Promise<string[]> => {
    const lines: string[] = [];
    for await (const line of stream.lines) lines.push(line);
    return lines;
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
        expect(await connect(url).health()).toEqual({ available: true });
        driver.healthResult = { docker: null, image: true };
        expect(await connect(url).health()).toEqual({
            available: false,
            reason: 'The AI launcher cannot reach Docker',
        });
        driver.healthResult = { docker: '27.0.1', image: false };
        expect(await connect(url).health()).toMatchObject({ reason: 'The agent image is missing' });
        await writeFile(keyFile, 'wrong');
        expect(await connect(url).health()).toEqual({
            available: false,
            reason: 'The AI launcher answered 401 unauthorized',
        });
    });

    it('a subscription token is not enough in production', async () => {
        const url = await startLauncher('oauth');
        expect(await connect(url).health()).toEqual({ available: true });
        expect(await connect(url, true).health()).toEqual({
            available: false,
            reason: 'Production needs an Anthropic API key, not a subscription token',
        });
    });

    it('no token, no key file, no launcher: unavailable', async () => {
        const url = await startLauncher(null);
        expect(await connect(url).health()).toMatchObject({ reason: 'The AI launcher has no Anthropic token' });
        const unreachable = await connect('http://127.0.0.1:1').health();
        expect(unreachable).toMatchObject({ available: false, reason: expect.stringContaining('unreachable') });
        await rm(keyFile);
        expect((await connect(url).health()).available).toBe(false);
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
