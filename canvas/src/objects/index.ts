/**
 * The domain objects (VISUALIZER_PLAN §3.2 `objects/`).
 *
 * Every one obeys design rule 2: it has an `id` and an arbitrary `meta` bag, and knows nothing
 * about locations, passages or chapters. The Visualizer maps its ids onto these; the mapping is
 * not in here.
 */

export * from './PolygonObject';
export * from './BoxObject';
export * from './EdgeObject';
export * from './NoteObject';
export * from './BrushStroke';
export * from './ImageObject';
