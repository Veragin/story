# MultiEngine — scaffold

Both workspaces here boot, occupy their ports and report that they are not implemented. That is
all they do. REFACTOR_PLAN §10 risk 5: "MultiEngine remains a scaffold. The plan makes room for
it; it does not build it."

| Workspace | Package                      | Port | Run                                  |
| --------- | ---------------------------- | ---- | ------------------------------------ |
| `client/` | `@story/multi-engine-client` | 8102 | `yarn dev:multi-engine` (vite)       |
| `server/` | `@story/multi-engine-server` | 8124 | `yarn dev:multi-engine-server` (tsx) |

The server has no build step and no `dist/` — it runs its TypeScript directly under `tsx`, the
same source-only rule the rest of the monorepo follows (§7).

## What is not built

From the README's MultiEngine section and REFACTOR_PLAN §3, in the order they should probably be
tackled:

1. **Player → character assignment.** _"every player picks his character"_. A session needs a
   connection → `TCharacterId` map; the characters nobody picked are driven by the engine.
   `TWorldState.mainCharacterId` is the single-player assumption this replaces.
2. **Server-owned world state, synced to clients.** The server builds `TWorldState` at boot today
   (`buildWorldState` from `@story/core`) and never touches it again. What is missing is the wire
   format and a client that applies it. `loadWorldState` / `copyWorldState` in `@story/core` are
   the serialisation pair to build on; the state is already mobx-observable, so the change feed
   exists.
3. **The turn barrier.** _"moving between passages costs some time, player has to wait till
   everyone played previous passages"_. Each move produces a time cost (`Story.spendTime`,
   `Processor`); the server holds the advance until every assigned character has committed, then
   runs the turn once.
4. **The transport.** §3 says "ws + http". Only http exists. Node has no built-in WebSocket
   _server_, so the ws half means adding the `ws` package — not worth buying for a scaffold that
   would not speak a protocol. The seam is marked in `server/src/index.ts`'s `upgrade` handler.
5. **The client's passage rendering.** It will reuse `SingleEngine/src/templates/`. §3 defers
   extracting those into `@story/ui` _"until MultiEngine is actually built — don't generalize on
   spec"_, so this phase left them where they are and the client renders a static page.

## One finding worth keeping

`@story/core` runs under plain node — verified with `tsx`, not assumed — with one exception:
`new Engine(s)` throws `ReferenceError: localStorage is not defined` from
`Engine.loadStateFromLocalStorage` (`core/src/engine/Engine.ts:55`, reached from the constructor
at line 27). `buildWorldState` is unaffected, which is why the server can use it. The ambient
global `_` is fine: core imports `@story/shared`, and evaluating its `translations.ts` installs it.

Note the type system is blind to this: `@types/node` declares `var localStorage: Storage` as a
global (node 22 ships webstorage only behind `--experimental-webstorage`), so `server/tsconfig.json`
compiles clean even with `lib: ["ES2022"]` and no DOM. The fix is to give `Engine` an injected
save-store port, the way `createWorldState` already injects the register — it belongs in
`@story/core`, not in a shim here, and it is a precondition for this server ever driving a game.
