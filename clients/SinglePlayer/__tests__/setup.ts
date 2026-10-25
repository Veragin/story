import { beforeEach } from 'vitest';
// installs the global `_` translator, which the app gets via `@story/ui` in `main.tsx`
import '@story/shared';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

// a leaked save would resume the previous test's game
beforeEach(() => {
    localStorage.clear();
});
