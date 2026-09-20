/**
 * `@story/multi-engine-server` — **scaffold only**. Nothing here plays a story.
 *
 * Phase 9 of REFACTOR_PLAN builds the workspace, the port and the boot path; §10 risk 5 is
 * explicit that "MultiEngine remains a scaffold. The plan makes room for it; it does not
 * build it." So every request is answered `501 Not Implemented`, and the three real pieces
 * are written down below rather than guessed at.
 *
 * What exists: an http server on :8124 and this story's `TWorldState`, built at boot from
 * `@story/data`'s register through `@story/core`'s `buildWorldState`. That is deliberate and
 * not decoration — it is the proof that the headless runtime really does run under plain node
 * (see "Running @story/core under node" below), which is the precondition for all of it.
 *
 * What does NOT exist, and is what §3 + the README's MultiEngine section ask for:
 *
 *  1. **Player → character assignment.** "every player picks his character". The world state
 *     already carries the playable set (`worldState.characters`), and `mainCharacterId` is the
 *     SingleEngine assumption this has to replace: a session needs a map of
 *     connection → `TCharacterId`, with the unpicked characters driven by the engine.
 *  2. **World-state sync.** One authoritative `TWorldState` here, patches out to the clients.
 *     `@story/core` makes the state observable through mobx (`makeAutoObservable` in `Engine`),
 *     so the change feed is available; what is missing is the wire format and a client that
 *     applies it. `@story/core`'s `loadWorldState`/`copyWorldState` are the serialisation pair
 *     to build it on.
 *  3. **The turn barrier.** "moving between passages costs some time, player has to wait till
 *     everyone played previous passages". Each player's move produces a time cost (see
 *     `Story.spendTime` / `Processor` in `@story/core`); the server holds the advance until
 *     every assigned character has committed a move, then runs the turn once.
 *
 * ## Running `@story/core` under node
 *
 * Verified, not assumed — `tsx` on a script that imports the package and constructs an
 * `Engine`:
 *
 *  - Importing `@story/core` works. The ambient global `_` is installed transitively: core
 *    imports `@story/shared`, and evaluating its `translations.ts` assigns `globalThis._`.
 *  - `buildWorldState(register, itemInfo)` works, which is why this file can call it.
 *  - `new Engine(s)` **throws** under node:
 *      `ReferenceError: localStorage is not defined`
 *      at `Engine.loadStateFromLocalStorage` (core/src/engine/Engine.ts:55), reached from the
 *      `Engine` constructor (core/src/engine/Engine.ts:27).
 *    `Engine` treats localStorage as its save-game store, and node has no localStorage. With a
 *    three-method shim (`getItem`/`setItem`/`removeItem`) the constructor completes and
 *    resolves an active passage, so the coupling is shallow — but it is a real one and the fix
 *    belongs in `@story/core` (inject a save-store port the way `createWorldState` already
 *    injects the register), not in a shim here. Until then this server cannot construct an
 *    `Engine`, which is why it only builds the state.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import { buildWorldState } from '@story/core';
import { itemInfo, register, type TWorldState } from '@story/data';

const HOST = '0.0.0.0'; // not `localhost`: the port has to be reachable from outside the container (§7)
const PORT = 8124; // REFACTOR_PLAN §2 Ports: 8100 SingleEngine, 8101 Visualizer client, 8102 MultiEngine client

/**
 * The world state this server will own once it is built. Pristine and never mutated today —
 * mutating it is exactly the not-implemented part.
 */
const worldState: TWorldState = buildWorldState(register, itemInfo);

const notImplemented = {
    service: '@story/multi-engine-server',
    status: 'not implemented',
    detail:
        'The MultiEngine server is a scaffold (REFACTOR_PLAN §10 risk 5). It boots and owns the ' +
        'story world state, but no multiplayer session, character assignment or turn barrier exists yet.',
    missing: ['player -> character assignment', 'world-state sync to clients', 'wait-for-everyone turn barrier'],
    /* Evidence that the headless runtime loaded: the pieces a session would be built out of. */
    worldState: {
        loaded: true,
        playableCharacters: Object.keys(worldState.characters),
        chapters: Object.keys(worldState.chapters),
    },
} as const;

const handleRequest = (req: IncomingMessage, res: ServerResponse) => {
    // Every route, every method — there is no route that does anything yet, and answering
    // 404 on the ones that do not exist would imply the others do.
    res.writeHead(501, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
    });
    res.end(JSON.stringify({ ...notImplemented, request: { method: req.method, url: req.url } }, null, 2) + '\n');
};

/**
 * §3 asks for "ws + http". Only the http half is here: node has no built-in WebSocket
 * *server* (`node:http`'s `upgrade` event hands you a raw socket, and `WebSocket` in node 22
 * is a client), so a real endpoint means taking on the `ws` package. That is a dependency
 * bought for a scaffold that would not speak a protocol, so it is deliberately not added.
 *
 * The seam is here: `ws` would attach with `new WebSocketServer({ noServer: true })` and this
 * handler would call `wss.handleUpgrade(req, socket, head, …)`. Until then an upgrade attempt
 * gets the same honest answer as everything else, spoken at the HTTP level because the
 * handshake has not completed and there is no WebSocket frame to send it in.
 */
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
