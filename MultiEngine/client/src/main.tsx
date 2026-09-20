/**
 * `@story/multi-engine-client` — **scaffold only**. It boots, it occupies :8102, and it says so
 * on screen. REFACTOR_PLAN §10 risk 5: "MultiEngine remains a scaffold. The plan makes room for
 * it; it does not build it." What is missing, and in what order to build it, is in
 * `MultiEngine/README.md`; what this page will grow into is in `./MultiEngine`.
 *
 * Same shape as `SingleEngine/src/main.tsx` and `Visualizer/client/src/main.tsx`: mount the app
 * inside `@story/ui`'s `GlobalThemeWrapper` and pull in the one stylesheet.
 */

import { createRoot } from 'react-dom/client';
import { GlobalThemeWrapper } from '@story/ui';
import { MultiEngine } from './MultiEngine';
import '@story/ui/index.css';

createRoot(document.getElementById('root')!).render(
    <GlobalThemeWrapper>
        <MultiEngine />
    </GlobalThemeWrapper>
);
