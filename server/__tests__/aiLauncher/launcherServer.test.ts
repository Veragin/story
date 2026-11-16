import { request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Duplex } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AgentProcesses } from '../../aiLauncher/AgentProcesses';
import { AGENT_UPGRADE_PROTOCOL } from '../../aiLauncher/agentStream';
import type { TAiTokenKind } from '../../aiLauncher/aiToken';
import { createLauncherServer } from '../../aiLauncher/launcherServer';
import { ndjsonLines } from '../../aiLauncher/ndjson';
import { FakeDriver } from './fakeAgent';

const KEY = 'launcher-key';
const AUTH = { Authorization: `Bearer ${KEY}` };

type TReply = { status: number; body: unknown };
type TUpgrade = { kind: 'upgraded'; socket: Duplex; lines: AsyncIterator<string> } | ({ kind: 'reply' } & TReply);

let server: Server;
let driver: FakeDriver;
let processes: AgentProcesses;
let port: number;

const listen = async (tokenKind: TAiTokenKind | null) => {
    driver = new FakeDriver();
    processes = new AgentProcesses(driver, { removeAfterMs: 10_000, stderrTailBytes: 4096 }, () => undefined);
    server = createLauncherServer({
        key: KEY,
        tokenKind,
        driver,
        processes,
        limits: { models: ['claude-sonnet-5-5'], maxBudgetUsd: 5 },
        log: () => undefined,
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address: AddressInfo | string | null = server.address();
    if (typeof address !== 'object' || address === null) throw new Error('no port');
    port = address.port;
};

const readBody = async (stream: AsyncIterable<Buffer>): Promise<unknown> => {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk);
    const text = Buffer.concat(chunks).toString('utf8');
    return text ? JSON.parse(text) : null;
};

const call = (method: string, path: string, headers: Record<string, string> = AUTH): Promise<TReply> =>
    new Promise((resolve, reject) => {
        const req = request({ host: '127.0.0.1', port, method, path, headers }, (res) => {
            const finish = async () => resolve({ status: res.statusCode ?? 0, body: await readBody(res) });
            finish().catch(reject);
        });
        req.on('error', reject);
        req.end();
    });

const openAgent = (body: string, headers: Record<string, string> = AUTH): Promise<TUpgrade> =>
    new Promise((resolve, reject) => {
        const req = request({
            host: '127.0.0.1',
            port,
            method: 'POST',
            path: '/agents',
            headers: {
                ...headers,
                'Connection': 'Upgrade',
                'Upgrade': AGENT_UPGRADE_PROTOCOL,
                'Content-Type': 'application/json',
                'Content-Length': String(Buffer.byteLength(body)),
            },
        });
        req.on('upgrade', (res, socket, head) => {
            if (head.length > 0) socket.unshift(head);
            expect(res.statusCode).toBe(101);
            expect(res.headers.upgrade).toBe(AGENT_UPGRADE_PROTOCOL);
            resolve({ kind: 'upgraded', socket, lines: ndjsonLines(socket)[Symbol.asyncIterator]() });
        });
        req.on('response', (res) => {
            const finish = async () =>
                resolve({ kind: 'reply', status: res.statusCode ?? 0, body: await readBody(res) });
            finish().catch(reject);
        });
        req.on('error', reject);
        req.end(body);
    });

const upgraded = async (body: string) => {
    const result = await openAgent(body);
    if (result.kind !== 'upgraded') throw new Error(`expected an upgrade, got ${result.status}`);
    return result;
};

const nextJson = async (lines: AsyncIterator<string>): Promise<unknown> => {
    const next = await lines.next();
    return next.done ? null : JSON.parse(next.value);
};

const readLine = async (stream: AsyncIterable<Buffer>): Promise<string> => {
    for await (const line of ndjsonLines(stream)) return line;
    return '';
};

const VALID = JSON.stringify({ storyId: 'demo', maxBudgetUsd: 1 });

afterEach(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
});

describe('launcher HTTP API', () => {
    beforeEach(() => listen('api_key'));

    it('rejects requests without the bearer key', async () => {
        expect(await call('GET', '/health', {})).toEqual({ status: 401, body: { error: 'unauthorized' } });
        expect(await call('GET', '/agents', { Authorization: 'Bearer wrong' })).toMatchObject({ status: 401 });
        expect(await call('GET', '/agents', { Authorization: KEY })).toMatchObject({ status: 401 });
        expect(await openAgent(VALID, { Authorization: `Bearer ${KEY}x` })).toEqual({
            kind: 'reply',
            status: 401,
            body: { error: 'unauthorized' },
        });
        expect(driver.requests).toEqual([]);
    });

    it('reports health', async () => {
        expect(await call('GET', '/health')).toEqual({
            status: 200,
            body: { docker: '27.0.1', image: true, token: 'api_key', driver: 'docker-run' },
        });
    });

    it('answers 404, 405 and 426', async () => {
        expect(await call('GET', '/nope')).toEqual({ status: 404, body: { error: 'not_found' } });
        expect(await call('PUT', '/agents')).toEqual({ status: 405, body: { error: 'method_not_allowed' } });
        expect(await call('POST', '/agents')).toEqual({ status: 426, body: { error: 'upgrade_required' } });
        expect(await call('DELETE', '/agents/story-ai-ghost')).toEqual({ status: 404, body: { error: 'not_found' } });
    });

    it.each([
        ['invalid JSON', '{storyId'],
        ['a bad story id', JSON.stringify({ storyId: '../x', maxBudgetUsd: 1 })],
        ['a budget over the cap', JSON.stringify({ storyId: 'demo', maxBudgetUsd: 6 })],
        ['an unknown model', JSON.stringify({ storyId: 'demo', maxBudgetUsd: 1, model: 'other' })],
        ['an unknown key', JSON.stringify({ storyId: 'demo', maxBudgetUsd: 1, mounts: ['/'] })],
    ])('answers 400 to %s', async (_, body) => {
        const result = await openAgent(body);
        expect(result).toMatchObject({ kind: 'reply', status: 400, body: { error: 'bad_request' } });
        expect(driver.requests).toEqual([]);
    });

    it('answers 500 when the docker client cannot start', async () => {
        driver.failSpawn = new Error('spawn docker ENOENT');
        expect(await openAgent(VALID)).toEqual({
            kind: 'reply',
            status: 500,
            body: { error: 'spawn_failed', message: 'spawn docker ENOENT' },
        });
    });

    it('streams NDJSON both ways between the socket and the CLI', async () => {
        const { socket, lines } = await upgraded(
            JSON.stringify({ storyId: 'demo', maxBudgetUsd: 2, model: 'claude-sonnet-5-5' })
        );
        const child = driver.lastChild();
        expect(driver.requests).toEqual([{ storyId: 'demo', maxBudgetUsd: 2, model: 'claude-sonnet-5-5' }]);
        expect(await nextJson(lines)).toEqual({
            type: 'launcher',
            event: 'started',
            containerName: 'story-ai-demo-1',
            pid: 4242,
        });
        expect(await call('GET', '/agents')).toEqual({
            status: 200,
            body: [{ containerName: 'story-ai-demo-1', storyId: 'demo', pid: 4242 }],
        });

        const userLine = '{"type":"user","message":{"role":"user","content":"hi"}}';
        socket.write(`${userLine}\n{"type":"launcher_control","action":"interrupt"}\n`);
        expect(await readLine(child.stdin)).toBe(userLine);
        await new Promise((resolve) => setImmediate(resolve));
        expect(child.signals).toEqual(['SIGINT']);

        child.stdout.write('{"type":"system","subtype":"init","session_id":"s1"}\n{"type":"res');
        child.stdout.write('ult","total_cost_usd":0.1}\n');
        expect(await nextJson(lines)).toEqual({ type: 'system', subtype: 'init', session_id: 's1' });
        expect(await nextJson(lines)).toEqual({ type: 'result', total_cost_usd: 0.1 });

        child.stderr.write('boom\n');
        child.exit(1);
        expect(await nextJson(lines)).toEqual({ type: 'launcher', event: 'exited', code: 1, stderrTail: 'boom\n' });
        expect(await lines.next()).toEqual({ done: true, value: undefined });
        expect(child.signals).toEqual(['SIGINT']);
    });

    it('runs the stop sequence when the server closes the socket', async () => {
        const { socket, lines } = await upgraded(VALID);
        await nextJson(lines);
        const child = driver.lastChild();
        socket.end();
        await new Promise((resolve) => setTimeout(resolve, 50));
        expect(child.signals).toEqual(['SIGTERM']);
        expect(driver.calls).toEqual(['stop story-ai-demo-1']);
        child.exit(143);
        expect(await nextJson(lines)).toMatchObject({ type: 'launcher', event: 'exited', code: 143 });
    });

    it('stops one agent by container name and all on DELETE /agents', async () => {
        const first = await upgraded(VALID);
        await nextJson(first.lines);
        const stopping = call('DELETE', '/agents/story-ai-demo-1');
        await new Promise((resolve) => setTimeout(resolve, 50));
        driver.lastChild().exit(0);
        expect(await stopping).toEqual({ status: 200, body: { ok: true } });
        expect(await nextJson(first.lines)).toMatchObject({ event: 'exited', code: 0 });

        const second = await upgraded(VALID);
        await nextJson(second.lines);
        driver.orphans = 1;
        const stoppingAll = call('DELETE', '/agents');
        await new Promise((resolve) => setTimeout(resolve, 50));
        driver.lastChild().exit(0);
        expect(await stoppingAll).toEqual({ status: 200, body: { removed: 1 } });
        expect(driver.calls).toEqual(['stop story-ai-demo-1', 'stop story-ai-demo-2', 'cleanup']);
    });
});

describe('launcher without a token', () => {
    beforeEach(() => listen(null));

    it('reports token null and refuses to spawn with 503', async () => {
        expect(await call('GET', '/health')).toMatchObject({ status: 200, body: { token: null } });
        expect(await openAgent(VALID)).toEqual({ kind: 'reply', status: 503, body: { error: 'token_unavailable' } });
        expect(driver.requests).toEqual([]);
    });
});
