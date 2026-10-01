// Scaffold: answers 501 to everything. Builds only the world state, since `Engine` needs
// `localStorage`, which node lacks.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import { buildWorldState } from '@story/core';
import { itemInfo, register, type TWorldState } from '@story/data';

// not `localhost`: reachable from outside the container
const HOST = '0.0.0.0';
const PORT = 8124;

const worldState: TWorldState = buildWorldState(register, itemInfo);

const notImplemented = {
    service: '@story/multi-engine-server',
    status: 'not implemented',
    detail:
        'The MultiEngine server is a scaffold. It boots and owns the ' +
        'story world state, but no multiplayer session, character assignment or turn barrier exists yet.',
    missing: ['player -> character assignment', 'world-state sync to clients', 'wait-for-everyone turn barrier'],
    worldState: {
        loaded: true,
        playableCharacters: Object.keys(worldState.characters),
        chapters: Object.keys(worldState.chapters),
    },
} as const;

const handleRequest = (req: IncomingMessage, res: ServerResponse) => {
    res.writeHead(501, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
    });
    res.end(JSON.stringify({ ...notImplemented, request: { method: req.method, url: req.url } }, null, 2) + '\n');
};

// no WebSocket server yet: node has none built in and `ws` is not a dependency
const handleUpgrade = (_req: IncomingMessage, socket: Duplex) => {
    socket.end('HTTP/1.1 501 Not Implemented\r\nConnection: close\r\n\r\n');
};

const server = createServer(handleRequest);
server.on('upgrade', handleUpgrade);

server.listen(PORT, HOST, () => {
    console.log(
        `[multi-engine-server] listening on http://${HOST}:${PORT} — not implemented, every request answers 501`
    );
    console.log(
        `[multi-engine-server] world state built from @story/data: ${
            Object.keys(worldState.characters).length
        } playable characters, ${Object.keys(worldState.chapters).length} chapters`
    );
});

const shutdown = () => {
    server.close(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
