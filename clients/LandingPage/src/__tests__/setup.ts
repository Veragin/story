// installs the global `_` translator, which the app gets via `@story/ui` in `main.tsx`
import '@story/shared';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
