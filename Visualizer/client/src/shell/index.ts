/** Public API of the shell, for pages. `Shell` itself is imported from './Shell' by main.tsx only
 * (keeping it out of this barrel avoids an import cycle with the pages). */
export { router, parseHash, routeToHash, ENTITY_KINDS, DEFAULT_ROUTE } from './router';
export type { TRoute, TPage, TEntityKind } from './router';
export { ControlBar } from './ControlBar';
export { shell } from './shellStore';
export { modals } from './modals';
export { ModalHost } from './ModalHost';
export { ConfirmDialog } from './ConfirmDialog';
export type { TConfirmOptions, TModalRender } from './modals';
export { keyboard, useKey, isEditableTarget } from './keyboard';
export type { TKeyHandler, TKeyOptions } from './keyboard';
export { PageContainer, PagePlaceholder } from './Page';
