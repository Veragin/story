/**
 * Legacy: the rest of the old timeline was replaced by `pages/Timeline` (WP5). This constant is
 * still imported by the old `GUIComponents/Canvas/CanvasManager` engine and `stores/CanvasHandler`;
 * delete the file together with them.
 */
export const RESOLUTION_FACTOR = window.devicePixelRatio || 1;
