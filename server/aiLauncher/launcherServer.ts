import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import type { AgentProcesses, TRunningAgent } from './AgentProcesses';
import { DEFAULT_AGENTS_CONFIG, type TGeminiConfig } from './agentsConfig';
import { AGENT_UPGRADE_PROTOCOL, runAgentStream } from './agentStream';
import type { TAiTokenKind } from './aiToken';
import { isBearerAuthorized } from './bearerAuth';
import type { TGeminiClient } from './gemini/geminiClient';
import { acceptUpgrade, rejectUpgrade, sendJson } from './httpReplies';
import { createImagesRoute } from './imagesRoute';
import { parseJson } from './jsonBody';
import { parseLaunchRequest, type TLaunchLimits, type TLaunchRequestResult } from './launchRequest';
import type { TAiSandboxDriver } from './sandbox/TAiSandboxDriver';
import { readUpgradeBody } from './upgradeBody';

export type TLauncherHealth = {
    docker: string | null;
    image: boolean;
    token: TAiTokenKind | null;
    driver: TAiSandboxDriver['name'];
    gemini: boolean;
    imageModels: string[];
};

export type TLauncherGemini = { client: TGeminiClient | null; config: TGeminiConfig };

export type TLauncherServerDeps = {
    key: string;
    tokenKind: TAiTokenKind | null;
    driver: TAiSandboxDriver;
    processes: AgentProcesses;
    limits: TLaunchLimits;
    gemini?: TLauncherGemini;
    log?: (message: string) => void;
};

const AGENTS_PATH = '/agents';
const AGENT_PATH = /^\/agents\/([^/]+)$/;
const IMAGES_PATH = '/images';
const NO_GEMINI: TLauncherGemini = { client: null, config: DEFAULT_AGENTS_CONFIG.gemini };
const MAX_BODY_BYTES = 16 * 1024;
const BODY_TIMEOUT_MS = 10_000;

const pathOf = (req: IncomingMessage): string => new URL(req.url ?? '/', 'http://launcher').pathname;

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export const createLauncherServer = (deps: TLauncherServerDeps): Server => {
    const { driver, processes } = deps;
    const log = deps.log ?? console.error;
    const gemini = deps.gemini ?? NO_GEMINI;
    const images = createImagesRoute({ ...gemini, log });

    const health = async (): Promise<TLauncherHealth> => ({
        ...(await driver.health()),
        token: deps.tokenKind,
        driver: driver.name,
        gemini: gemini.client !== null,
        imageModels: Object.keys(gemini.config.imageModels),
    });

    const stopAgent = async (res: ServerResponse, encodedName: string) => {
        const stopped = await processes.stop(decodeURIComponent(encodedName));
        sendJson(res, stopped ? 200 : 404, stopped ? { ok: true } : { error: 'not_found' });
    };

    const stopAll = async (res: ServerResponse) => {
        await processes.stopAll();
        sendJson(res, 200, { removed: await processes.cleanupOrphans() });
    };

    const route = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
        if (!isBearerAuthorized(req.headers.authorization, deps.key))
            return sendJson(res, 401, { error: 'unauthorized' });
        const pathname = pathOf(req);
        const agentName = AGENT_PATH.exec(pathname)?.[1];
        if (pathname === '/health' && req.method === 'GET') return sendJson(res, 200, await health());
        if (pathname === AGENTS_PATH && req.method === 'GET') return sendJson(res, 200, processes.list());
        if (pathname === AGENTS_PATH && req.method === 'POST') return sendJson(res, 426, { error: 'upgrade_required' });
        if (pathname === AGENTS_PATH && req.method === 'DELETE') return await stopAll(res);
        if (agentName !== undefined && req.method === 'DELETE') return await stopAgent(res, agentName);
        if (pathname === IMAGES_PATH && req.method === 'POST') return await images(req, res);
        const known =
            pathname === '/health' || pathname === AGENTS_PATH || pathname === IMAGES_PATH || agentName !== undefined;
        sendJson(res, known ? 405 : 404, { error: known ? 'method_not_allowed' : 'not_found' });
    };

    const launch = async (req: IncomingMessage, socket: Duplex, head: Buffer): Promise<TRunningAgent | null> => {
        if (!isBearerAuthorized(req.headers.authorization, deps.key)) {
            rejectUpgrade(socket, 401, { error: 'unauthorized' });
            return null;
        }
        if (pathOf(req) !== AGENTS_PATH || req.method !== 'POST') {
            rejectUpgrade(socket, 404, { error: 'not_found' });
            return null;
        }
        if (req.headers.upgrade?.toLowerCase() !== AGENT_UPGRADE_PROTOCOL) {
            rejectUpgrade(socket, 400, { error: 'bad_request', message: `Upgrade must be ${AGENT_UPGRADE_PROTOCOL}` });
            return null;
        }
        const length = Number(req.headers['content-length']);
        if (!Number.isInteger(length) || length <= 0) {
            rejectUpgrade(socket, 400, {
                error: 'bad_request',
                message: 'A JSON body with Content-Length is required',
            });
            return null;
        }
        if (length > MAX_BODY_BYTES) {
            rejectUpgrade(socket, 413, { error: 'payload_too_large' });
            return null;
        }
        const json = parseJson(await readUpgradeBody(socket, head, length, BODY_TIMEOUT_MS));
        const parsed: TLaunchRequestResult = json.ok
            ? parseLaunchRequest(json.value, deps.limits)
            : { ok: false, message: 'Invalid JSON' };
        if (!parsed.ok) {
            rejectUpgrade(socket, 400, { error: 'bad_request', message: parsed.message });
            return null;
        }
        if (!deps.tokenKind) {
            rejectUpgrade(socket, 503, { error: 'token_unavailable' });
            return null;
        }
        try {
            return await processes.start(parsed.request);
        } catch (e) {
            log(`spawn failed for ${parsed.request.storyId}: ${errorMessage(e)}`);
            rejectUpgrade(socket, 500, { error: 'spawn_failed', message: errorMessage(e) });
            return null;
        }
    };

    const upgrade = async (req: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> => {
        const agent = await launch(req, socket, head);
        if (!agent) return;
        if (socket.destroyed) {
            await processes.stop(agent.containerName);
            return;
        }
        acceptUpgrade(socket, AGENT_UPGRADE_PROTOCOL);
        log(`agent ${agent.containerName} started (pid ${agent.pid})`);
        await runAgentStream(socket, agent, processes);
        log(`agent ${agent.containerName} exited`);
    };

    const server = createServer((req, res) => {
        const handle = async () => {
            try {
                await route(req, res);
            } catch (e) {
                log(`${req.method} ${req.url} failed: ${errorMessage(e)}`);
                if (!res.headersSent) sendJson(res, 500, { error: 'internal_error' });
            }
        };
        void handle();
    });

    server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
        socket.on('error', (e) => log(`agent stream socket error: ${e.message}`));
        const handle = async () => {
            try {
                await upgrade(req, socket, head);
            } catch (e) {
                log(`agent stream failed: ${errorMessage(e)}`);
                socket.destroy();
            }
        };
        void handle();
    });

    return server;
};
