import type { TEngineSettings } from '@story/types';

// lazy, as passages are: node (MultiEngine, the server, tests) must never load React or TSX
export const engine: TEngineSettings = {
    Topbar: () => import('./Topbar'),
};
