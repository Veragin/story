/**
 * Canvas library (Visualizer plan WP3): a scene of shapes over a pan/zoom camera, with
 * selection, dragging, rect resize, polygon vertex editing and a line tool. Framework-free;
 * React pages create a `Scene` in an effect and `destroy()` it on cleanup.
 */
export * from './types';
export * as geometry from './geometry';
export { Camera, type TCameraListener, type TCameraOptions, type TCameraState } from './Camera';
export { Emitter } from './Emitter';
export { isTypingTarget } from './input';
export { measureTextWidth, wrapText, drawTextBlock } from './text';
export {
    Scene,
    Layer,
    type ISceneInteraction,
    type TChangeKind,
    type TDrawHook,
    type TPointerInfo,
    type TSceneEvents,
    type TSceneOptions,
    type TScenePointerEvent,
} from './Scene';
export {
    Shape,
    applyStroke,
    type IShapeHost,
    type TDragOptions,
    type TLabelStyle,
    type TRenderContext,
    type TShapeProps,
} from './shapes/Shape';
export { RectShape, type TRectEdge, type TRectProps } from './shapes/RectShape';
export { PolygonShape, type TPolygonProps } from './shapes/PolygonShape';
export {
    LineShape,
    drawArrowHead,
    isAnchor,
    type TArrow,
    type TLineEnd,
    type TLineProps,
    type TShapeAnchor,
} from './shapes/LineShape';
export { TextShape, type TTextProps } from './shapes/TextShape';
export { SelectionController, resizeRect, type TSelectionOptions } from './controllers/SelectionController';
export { VertexEditController, type TVertexEditOptions } from './controllers/VertexEditController';
export { LineTool, type TLineToolEvents, type TLineToolOptions } from './controllers/LineTool';
