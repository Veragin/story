/**
 * Vitest setup for the `visualizer-landing-page` jsdom project.
 *
 * - Installs the global `_` translator, which the app gets from importing `@story/ui` in
 *   `main.tsx` (a test that imports only a dialog would not).
 * - Tells React that this is a test environment, so `act()` flushes renders and effects.
 */
import '@story/shared';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
