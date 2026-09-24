/**
 * Tools (VISUALIZER_PLAN §3.2 `tools/`). Exactly one is active at a time; see `ToolManager`.
 *
 * Every tool is a state machine over world-coordinate pointer events and emits its mutations as
 * history commands (design rules 1 and 4), which is what makes them testable against
 * `FakeRenderer` without a DOM or a native canvas.
 */

export * from './Tool';
export * from './ToolManager';
export * from './SelectTool';
export * from './PolygonDrawTool';
export * from './VertexEditTool';
export * from './BrushTool';
export * from './NoteTool';

/* Overlay furniture the tools draw with — exported because a host may want to reuse them. */
export * from './MarqueeObject';
export * from './VertexHandlesObject';
