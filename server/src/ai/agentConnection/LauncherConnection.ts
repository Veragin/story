import { request, type IncomingMessage } from 'node:http';
import path from 'node:path';
import type { Duplex } from 'node:stream';
import { AGENT_UPGRADE_PROTOCOL, type TLauncherControlLine } from '../../../aiLauncher/agentStream';
import { DEFAULT_AGENTS_CONFIG } from '../../../aiLauncher/agentsConfig';
import type { TGeneratedImage, TImageGeneration } from '../../../aiLauncher/gemini/generateImage';
import type { TImageRequest } from '../../../aiLauncher/imageRequest';
import { ndjsonLines, writeLine } from '../../../aiLauncher/ndjson';
import { CONTAINER_STORY_DIR } from '../../../aiLauncher/sandbox/dockerArgs';
import { readSecretFile } from '../../../aiLauncher/secretFile';
import { errorMessage, HttpError } from '../../common/HttpError';
import { isPlainObject } from '../../common/isPlainObject';
import { imageTooSlow, launcherImageError } from './imageErrors';
import type {
    TAgentConnection,
    TAgentHealth,
    TAgentExit,
    TAgentHandle,
    TAgentLaunch,
    TAgentLayout,
    TAgentStream,
    TAiHealth,
} from './TAgentConnection';

export type TLauncherConnectionOptions = {
    url: string;
    keyFile: string;
    sessionsDir: string;
    requireApiKey: boolean;
    requestTimeoutMs?: number;
    imageTimeoutMs?: number;
};

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

// the launcher's own Gemini timeout answers 504 first
export const IMAGE_TIMEOUT_MARGIN_MS = 15_000;

export const imageTimeoutOf = (geminiTimeoutMs: number) => geminiTimeoutMs + IMAGE_TIMEOUT_MARGIN_MS;

type TLauncherReply = { status: number; body: unknown };

type TCallOptions = { body?: unknown; timeoutMs?: number };

// Claude Code names a project folder after its working directory, every non-alphanumeric character a dash
export const TRANSCRIPTS_FOLDER = CONTAINER_STORY_DIR.replace(/[^a-zA-Z0-9]/g, '-');

const LOST_CONNECTION: TAgentExit = { code: null, stderrTail: 'The connection to the AI launcher was lost' };

export class LauncherError extends Error {
    constructor(
        readonly status: number,
        readonly code: string,
        message: string
    ) {
        super(message);
        this.name = 'LauncherError';
    }
}

const parseJson = (text: string): unknown => {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
};

const readText = async (stream: AsyncIterable<Buffer | string>): Promise<string> => {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    return Buffer.concat(chunks).toString('utf8');
};

const launcherError = (status: number, body: unknown): LauncherError => {
    const code = isPlainObject(body) && typeof body.error === 'string' ? body.error : 'unknown';
    const detail = isPlainObject(body) && typeof body.message === 'string' ? `: ${body.message}` : '';
    return new LauncherError(status, code, `The AI launcher answered ${status} ${code}${detail}`);
};

const startedLine = (line: string | undefined): TAgentHandle => {
    const message = line === undefined ? null : parseJson(line);
    if (
        !isPlainObject(message) ||
        message.type !== 'launcher' ||
        message.event !== 'started' ||
        typeof message.containerName !== 'string' ||
        typeof message.pid !== 'number'
    ) {
        throw new Error('The AI launcher did not report a started agent');
    }
    return { containerName: message.containerName, pid: message.pid };
};

// launcher lines carry `"type":"launcher"`; everything else is the CLI's own output
const exitedLine = (line: string): TAgentExit | 'other-launcher-line' | null => {
    if (!line.includes('"launcher"')) return null;
    const message = parseJson(line);
    if (!isPlainObject(message) || message.type !== 'launcher') return null;
    if (message.event !== 'exited') return 'other-launcher-line';
    const code = typeof message.code === 'number' ? message.code : null;
    return { code, stderrTail: typeof message.stderrTail === 'string' ? message.stderrTail : '' };
};

const agentsHealthOf = (body: unknown, requireApiKey: boolean): TAiHealth => {
    if (!isPlainObject(body)) return { available: false, reason: 'The AI launcher sent an unreadable health report' };
    if (typeof body.docker !== 'string') return { available: false, reason: 'The AI launcher cannot reach Docker' };
    if (body.image !== true) return { available: false, reason: 'The agent image is missing' };
    if (body.token !== 'api_key' && body.token !== 'oauth') {
        return { available: false, reason: 'The AI launcher has no Anthropic token' };
    }
    if (requireApiKey && body.token !== 'api_key') {
        return { available: false, reason: 'Production needs an Anthropic API key, not a subscription token' };
    }
    return { available: true };
};

const imageGenerationOf = (body: unknown): boolean =>
    isPlainObject(body) && body.gemini === true && Array.isArray(body.imageModels) && body.imageModels.length > 0;

export const healthOf = (body: unknown, requireApiKey: boolean): TAgentHealth => ({
    agents: agentsHealthOf(body, requireApiKey),
    imageGeneration: imageGenerationOf(body),
});

const unhealthy = (reason: string): TAgentHealth => ({
    agents: { available: false, reason },
    imageGeneration: false,
});

const isTimeoutError = (e: unknown): boolean => e instanceof Error && e.name === 'TimeoutError';

const isTimeout = (e: unknown): boolean => isTimeoutError(e) || (e instanceof Error && isTimeoutError(e.cause));

const isUsage = (value: unknown): value is TGeneratedImage['usage'] =>
    isPlainObject(value) &&
    typeof value.promptTokens === 'number' &&
    typeof value.candidatesTokens === 'number' &&
    typeof value.totalTokens === 'number';

const generatedImageOf = (body: unknown): TGeneratedImage => {
    if (
        !isPlainObject(body) ||
        typeof body.mimeType !== 'string' ||
        typeof body.data !== 'string' ||
        !isUsage(body.usage)
    ) {
        throw HttpError.of('ai_image_failed', 'The AI launcher sent an unreadable image');
    }
    return { mimeType: body.mimeType, data: body.data, usage: body.usage };
};

export class LauncherConnection implements TAgentConnection {
    private readonly timeoutMs: number;
    private readonly imageTimeoutMs: number;

    constructor(private readonly options: TLauncherConnectionOptions) {
        this.timeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
        this.imageTimeoutMs = options.imageTimeoutMs ?? imageTimeoutOf(DEFAULT_AGENTS_CONFIG.gemini.timeoutMs);
    }

    async health(): Promise<TAgentHealth> {
        let reply: TLauncherReply;
        try {
            reply = await this.call('GET', '/health');
        } catch (e) {
            return unhealthy(errorMessage(e));
        }
        if (reply.status !== 200) return unhealthy(launcherError(reply.status, reply.body).message);
        return healthOf(reply.body, this.options.requireApiKey);
    }

    async generateImage(storyId: string, generation: TImageGeneration): Promise<TGeneratedImage> {
        const body: TImageRequest = { storyId, ...generation };
        let reply: TLauncherReply;
        try {
            reply = await this.call('POST', '/images', { body, timeoutMs: this.imageTimeoutMs });
        } catch (e) {
            if (isTimeout(e)) throw imageTooSlow();
            throw HttpError.of('ai_unavailable', 'The AI launcher is unreachable');
        }
        if (reply.status !== 200) throw launcherImageError(reply.status, reply.body);
        return generatedImageOf(reply.body);
    }

    async cleanupAll(): Promise<number> {
        const reply = await this.call('DELETE', '/agents');
        if (reply.status !== 200) throw launcherError(reply.status, reply.body);
        return isPlainObject(reply.body) && typeof reply.body.removed === 'number' ? reply.body.removed : 0;
    }

    layout(storyId: string): TAgentLayout {
        const sessionsRoot = path.join(this.options.sessionsDir, storyId);
        return {
            storyRoot: CONTAINER_STORY_DIR,
            sessionsRoot,
            transcriptsDir: path.join(sessionsRoot, TRANSCRIPTS_FOLDER),
        };
    }

    async open(launch: TAgentLaunch): Promise<TAgentStream> {
        const socket = await this.upgrade(launch);
        try {
            return await this.attach(socket);
        } catch (e) {
            socket.destroy();
            throw e;
        }
    }

    private async key(): Promise<string> {
        const key = await readSecretFile(this.options.keyFile);
        if (key === null) throw new Error(`The AI launcher key file ${this.options.keyFile} is missing or empty`);
        return key;
    }

    private url(pathname: string): URL {
        return new URL(pathname, `${this.options.url}/`);
    }

    private async call(
        method: string,
        pathname: string,
        { body, timeoutMs = this.timeoutMs }: TCallOptions = {}
    ): Promise<TLauncherReply> {
        const authorization = `Bearer ${await this.key()}`;
        const headers: Record<string, string> = { authorization };
        if (body !== undefined) headers['content-type'] = 'application/json';
        let res: Response;
        try {
            res = await fetch(this.url(pathname), {
                method,
                headers,
                body: body === undefined ? undefined : JSON.stringify(body),
                signal: AbortSignal.timeout(timeoutMs),
            });
        } catch (e) {
            throw new Error(`The AI launcher at ${this.options.url} is unreachable: ${errorMessage(e)}`, { cause: e });
        }
        return { status: res.status, body: parseJson(await res.text()) };
    }

    private async upgrade(launch: TAgentLaunch): Promise<Duplex> {
        const body = JSON.stringify(launch);
        const authorization = `Bearer ${await this.key()}`;
        return await new Promise<Duplex>((resolve, reject) => {
            const req = request(this.url('/agents'), {
                method: 'POST',
                timeout: this.timeoutMs,
                headers: {
                    'Authorization': authorization,
                    'Connection': 'Upgrade',
                    'Upgrade': AGENT_UPGRADE_PROTOCOL,
                    'Content-Type': 'application/json',
                    'Content-Length': String(Buffer.byteLength(body)),
                },
            });
            req.on('upgrade', (_res: IncomingMessage, socket: Duplex, head: Buffer) => {
                req.setTimeout(0);
                if (head.length > 0) socket.unshift(head);
                resolve(socket);
            });
            req.on('response', (res: IncomingMessage) => {
                const refuse = async () => {
                    const text = await readText(res);
                    reject(launcherError(res.statusCode ?? 0, parseJson(text)));
                };
                refuse().catch(reject);
            });
            req.on('timeout', () => req.destroy(new Error('The AI launcher did not answer in time')));
            req.on('error', (e) => reject(new Error(`The AI launcher could not start the agent: ${e.message}`)));
            req.end(body);
        });
    }

    private async attach(socket: Duplex): Promise<TAgentStream> {
        socket.on('error', () => undefined);
        const iterator = ndjsonLines(socket)[Symbol.asyncIterator]();
        const first = await iterator.next();
        const handle = startedLine(first.done ? undefined : first.value);
        let resolveExit: (exit: TAgentExit) => void = () => undefined;
        const exited = new Promise<TAgentExit>((resolve) => {
            resolveExit = resolve;
        });
        async function* cliLines(): AsyncGenerator<string> {
            let exit = LOST_CONNECTION;
            try {
                for (;;) {
                    const next = await iterator.next();
                    if (next.done) break;
                    const launcherLine = exitedLine(next.value);
                    if (launcherLine === null) yield next.value;
                    else if (launcherLine !== 'other-launcher-line') exit = launcherLine;
                }
            } catch {
                // a reset connection ends the stream like a close
            } finally {
                socket.destroy();
                resolveExit(exit);
            }
        }
        const interruptLine: TLauncherControlLine = { type: 'launcher_control', action: 'interrupt' };
        return {
            handle,
            lines: cliLines(),
            exited,
            send: (line) => writeLine(socket, line),
            interrupt: () => writeLine(socket, JSON.stringify(interruptLine)),
            close: () => {
                socket.end();
            },
        };
    }
}
