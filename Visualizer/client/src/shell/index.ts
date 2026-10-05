// `Shell` stays out of this barrel: it imports the pages, which import this
export { router, parseHash, routeToHash, ENTITY_KINDS, DEFAULT_ROUTE } from './router';
export type { TRoute, TPage, TEntityKind, TStructureSection } from './router';
export { ControlBar } from './ControlBar';
export { shell } from './shellStore';
export { modals } from './modals';
export { ModalHost } from './ModalHost';
export { ConfirmDialog } from './ConfirmDialog';
export type { TConfirmOptions, TModalRender } from './modals';
export { keyboard, useKey, isEditableTarget } from './keyboard';
export type { TKeyHandler, TKeyOptions } from './keyboard';
export { PageContainer } from './PageContainer';
