/**
 * `@story/ui` — the React/MUI primitives shared by every front-end.
 *
 * Layering (REFACTOR_PLAN §2, as amended): shared → types → { ui, core } → data → services.
 * `ui` may import `@story/shared` and `@story/types` and nothing else in the monorepo.
 *
 * The stylesheet is not re-exported here — a `.css` file cannot travel through a TS barrel.
 * Apps import it by its own package subpath: `import '@story/ui/index.css'`.
 */

/* Row, Column, WholeContainer */
export * from './components/Basic';
/* SmallText, Text, LargeText, Header, Title */
export * from './components/Text';
/* spacingCss */
export * from './components/css';
/* Modal */
export * from './components/Modal';

/* GlobalThemeWrapper */
export * from './theme/GlobalThemeWrapper';
/* the MUI theme itself, for apps that need to read palette values */
export { default as appTheme } from './theme/theme';

/* useSafeContext, createSafeContext */
export * from './createSafeContext';
/* applyFormatting — re-exported from `@story/shared`; importing it installs the global `_` */
export * from './translations';
/* showToast, setToastHandler — re-exported from `@story/shared` */
export * from './toast';
