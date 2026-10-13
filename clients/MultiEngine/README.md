# MultiEngine — scaffold

This client boots on port 8102 (`yarn dev:multi-engine`, package `@story/multi-engine-client`) and
reports that it is not implemented. That is all it does. REFACTOR_PLAN §10 risk 5: "MultiEngine
remains a scaffold. The plan makes room for it; it does not build it." The MultiEngine server
scaffold is gone; multiplayer will be a module of the one server when it is built.

## What is not built

From the README's MultiEngine section and REFACTOR_PLAN §3, in the order they should probably be
tackled:

1. **Player → character assignment.** _"every player picks his character"_. A session needs a
   connection → `TCharacterId` map; the characters nobody picked are driven by the engine.
   `TWorldState.mainCharacterId` is the single-player assumption this replaces.
2. **Server-owned world state, synced to clients.** The removed server scaffold built `TWorldState`
   at boot (`buildWorldState` from `@story/core`) and never touched it again. What is missing is the wire
   format and a client that applies it. `loadWorldState` / `copyWorldState` in `@story/core` are
   the serialisation pair to build on; the state is already mobx-observable, so the change feed
   exists.
3. **The turn barrier.** _"moving between passages costs some time, player has to wait till
   everyone played previous passages"_. Each move produces a time cost (`Story.spendTime`,
   `Processor`); the server holds the advance until every assigned character has committed, then
   runs the turn once.
4. **The transport.** §3 says "ws + http". Only http exists. Node has no built-in WebSocket
   _server_, so the ws half means adding the `ws` package — not worth buying for a scaffold that
   would not speak a protocol.
5. **The client's passage rendering.** It will reuse `clients/SingleEngine/src/templates/`. §3 defers
   extracting those into `@story/ui` _"until MultiEngine is actually built — don't generalize on
   spec"_, so this phase left them where they are and the client renders a static page.

## One finding worth keeping

`@story/core` runs under plain node — verified with `tsx`, not assumed — with one exception:
`new Engine(s, storyModule, storyId)` throws `ReferenceError: localStorage is not defined` from
`Engine.loadStateFromLocalStorage` (`clients/shared/core/src/engine/Engine.ts:72`, reached from the constructor
at line 39). `buildWorldState` is unaffected, which is why the removed server scaffold could use it. The ambient
global `_` is fine: core imports `@story/shared`, and evaluating its `translations.ts` installs it.

Note the type system is blind to this: `@types/node` declares `var localStorage: Storage` as a
global (node 22 ships webstorage only behind `--experimental-webstorage`), so a node-only tsconfig
compiles clean even with `lib: ["ES2022"]` and no DOM. The fix is to give `Engine` an injected
save-store port, the way `createWorldState` already injects the register — it belongs in
`@story/core`, not in a shim here, and it is a precondition for a server ever driving a game.
