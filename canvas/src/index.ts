/**
 * `@story/canvas` — the one canvas library every Visualizer view is built on
 * (VISUALIZER_PLAN §2, §3).
 *
 * Layering: this package imports `@story/shared` and nothing else internal (§3.1). It is a
 * rendering library that happens to live in this repo — no story types, no `data/`, no `core/`.
 * The day it renders something that is not this story, nothing has to be untangled.
 *
 * React lives behind the `./react` subpath and is a peer dependency; nothing exported here
 * touches it.
 *
 * ## The five design rules (§3.2), which are also the review criteria
 *
 * 1. **World units everywhere.** Every public API takes and returns world coordinates. Screen
 *    pixels appear in exactly one place: `Viewport`.
 * 2. **No story types.** An object has an `id` and an arbitrary `meta` bag; mapping that onto a
 *    `TLocationId` is the Visualizer's job.
 * 3. **Objects are observable, not React.** `SceneObject` emits change events and stores
 *    subscribe. There is no render loop in React.
 * 4. **Every mutation goes through history.** Tools emit commands; `history/` records them.
 * 5. **Serialisable.** `toJSON`/`fromJSON` on every object, because §4 persists them as
 *    TypeScript literals and the server writes that same shape.
 */

/* Scene, Layers, Viewport, SceneObject */
export * from './scene/Scene';
export * from './scene/Layers';
export * from './scene/Viewport';
export * from './scene/SceneObject';

/* The renderer port, its Konva implementation, and the fake the tests run against */
export * from './renderer/types';
export * from './renderer/KonvaRenderer';
export * from './renderer/FakeRenderer';

/* PolygonObject, BoxObject, EdgeObject, NoteObject, BrushStroke, ImageObject */
export * from './objects';

/* Select, polygon draw, vertex edit, brush, note — and the manager that owns exactly one */
export * from './tools';

/* Selection, snapping, and the always-on viewport navigation below the tools */
export * from './interaction/Selection';
export * from './interaction/Snapping';
export * from './interaction/Navigation';
export * from './interaction/Keyboard';

/* Polygon math, RDP simplification, flat-point conversion */
export * from './geometry';

/* Undo/redo and the moved memento machinery */
export * from './history';

/* Kamada–Kawai, spring-force, circular, left-to-right seeding */
export * from './layout';
