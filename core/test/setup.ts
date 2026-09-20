import { beforeEach } from 'vitest';
import { installLocalStorageStub } from './support/localStorage';

/**
 * `setupFiles` for the `core` project (see `vitest.workspace.ts`).
 *
 * A fresh, empty `localStorage` before every test: the engine persists the whole world state
 * under one key and reloads it in its constructor, so a leaked save from an earlier test would
 * silently resume that test's game inside the next one. See `./support/localStorage.ts` for
 * why the stub is needed at all.
 */
beforeEach(() => {
    installLocalStorageStub();
});
