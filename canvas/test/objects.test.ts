import { describe, expect, it, vi } from 'vitest';
import { BoxObject } from '../src/objects/BoxObject';
import { BrushStroke } from '../src/objects/BrushStroke';
import { EdgeObject } from '../src/objects/EdgeObject';
import { ImageObject } from '../src/objects/ImageObject';
import { NoteObject } from '../src/objects/NoteObject';
import { PolygonObject } from '../src/objects/PolygonObject';

const SQUARE = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
];

describe('PolygonObject', () => {
    it('stores the ring open and clockwise on canvas', () => {
        const polygon = new PolygonObject({ id: 'p', points: [...SQUARE].reverse() });
        expect(polygon.points).toHaveLength(4);
        // Normalised: the same shape drawn either way produces one spelling in `data/`.
        expect(polygon.toJSON().points).toEqual(expect.any(Array));
        const winding = polygon.points;
        expect(winding[0]).toEqual({ x: 0, y: 10 });
    });

    it('drops a duplicated closing point', () => {
        const polygon = new PolygonObject({ id: 'p', points: [...SQUARE, { x: 0, y: 0 }] });
        expect(polygon.vertexCount).toBe(4);
    });

    it('hit-tests exactly, not by bounding box', () => {
        const arrow = new PolygonObject({
            id: 'p',
            points: [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 10, y: 10 },
                { x: 5, y: 5 },
                { x: 0, y: 10 },
            ],
        });
        expect(arrow.hitTest({ x: 5, y: 1 })).toBe(true);
        // Inside the bounding box, outside the shape — the case a box hit test gets wrong.
        expect(arrow.hitTest({ x: 5, y: 9 })).toBe(false);
    });

    it('hits its outline within tolerance, so a thin shape is still clickable', () => {
        const polygon = new PolygonObject({ id: 'p', points: SQUARE });
        expect(polygon.hitTest({ x: -1, y: 5 })).toBe(false);
        expect(polygon.hitTest({ x: -1, y: 5 }, 2)).toBe(true);
    });

    it('moves a vertex', () => {
        const polygon = new PolygonObject({ id: 'p', points: SQUARE });
        polygon.moveVertex(0, { x: -5, y: -5 });
        expect(polygon.points[0]).toEqual({ x: -5, y: -5 });
    });

    it('ignores an out-of-range vertex index rather than growing the ring', () => {
        const polygon = new PolygonObject({ id: 'p', points: SQUARE });
        polygon.moveVertex(99, { x: 0, y: 0 });
        expect(polygon.vertexCount).toBe(4);
    });

    /** The contract `distanceToOutline` establishes: insert *after* the edge's first vertex. */
    it('inserts a vertex after the named edge', () => {
        const polygon = new PolygonObject({ id: 'p', points: SQUARE });
        polygon.insertVertex(0, { x: 5, y: 0 });
        expect(polygon.vertexCount).toBe(5);
        expect(polygon.points[1]).toEqual({ x: 5, y: 0 });
    });

    it('removes a vertex', () => {
        const polygon = new PolygonObject({ id: 'p', points: [...SQUARE, { x: -5, y: 5 }] });
        expect(polygon.removeVertex(0)).toBe(true);
        expect(polygon.vertexCount).toBe(4);
    });

    /** Below three points a polygon has no area and cannot be recovered by dragging. */
    it('refuses to go below three vertices', () => {
        const polygon = new PolygonObject({
            id: 'p',
            points: [
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 5, y: 10 },
            ],
        });
        expect(polygon.removeVertex(0)).toBe(false);
        expect(polygon.vertexCount).toBe(3);
    });

    it('translates every point', () => {
        const polygon = new PolygonObject({ id: 'p', points: SQUARE });
        polygon.translate({ x: 100, y: 0 });
        expect(polygon.bounds.min.x).toBe(100);
    });

    it('reports self-intersection', () => {
        const bowtie = new PolygonObject({
            id: 'p',
            points: [
                { x: 0, y: 0 },
                { x: 10, y: 10 },
                { x: 10, y: 0 },
                { x: 0, y: 10 },
            ],
        });
        expect(bowtie.selfIntersecting).toBe(true);
        expect(new PolygonObject({ id: 'q', points: SQUARE }).selfIntersecting).toBe(false);
    });

    /** A vertex drag must not re-wind the array under the index the tool is holding. */
    it('setPointsRaw does not normalise winding', () => {
        const polygon = new PolygonObject({ id: 'p', points: SQUARE });
        const reversed = [...polygon.points].reverse();
        polygon.setPointsRaw(reversed);
        expect(polygon.points[0]).toEqual(reversed[0]);
        expect(polygon.points[1]).toEqual(reversed[1]);
    });

    it('round-trips through JSON', () => {
        const polygon = new PolygonObject({ id: 'p', points: SQUARE, color: '#abcdef', label: 'Village', z: 3 });
        const clone = PolygonObject.fromJSON(polygon.toJSON());
        expect(clone.toJSON()).toEqual(polygon.toJSON());
    });

    it('draws fill, outline and label', () => {
        const polygon = new PolygonObject({ id: 'p', points: SQUARE, label: 'Village' });
        const spec = polygon.toSpec();
        expect(spec.kind).toBe('group');
        const kinds = spec.kind === 'group' ? spec.children.map((c) => c.kind) : [];
        expect(kinds).toEqual(['polygon', 'line', 'text']);
    });

    it('omits the label when there is none', () => {
        const spec = new PolygonObject({ id: 'p', points: SQUARE }).toSpec();
        const kinds = spec.kind === 'group' ? spec.children.map((c) => c.kind) : [];
        expect(kinds).toEqual(['polygon', 'line']);
    });
});

describe('BoxObject', () => {
    it('reports its centre', () => {
        const box = new BoxObject({ id: 'b', position: { x: 10, y: 20 }, size: { width: 100, height: 40 } });
        expect(box.center).toEqual({ x: 60, y: 40 });
    });

    it('translates', () => {
        const box = new BoxObject({ id: 'b', position: { x: 0, y: 0 }, size: { width: 10, height: 10 } });
        box.translate({ x: 5, y: -5 });
        expect(box.position).toEqual({ x: 5, y: -5 });
    });

    it('does not notify when set to its current position', () => {
        const box = new BoxObject({ id: 'b', position: { x: 1, y: 1 }, size: { width: 10, height: 10 } });
        const listener = vi.fn();
        box.onChange.subscribe(listener);
        box.position = { x: 1, y: 1 };
        expect(listener).not.toHaveBeenCalled();
    });

    /** Screen-pixel text is what makes a hundred-node graph readable at any zoom. */
    it('draws its label in screen pixels', () => {
        const box = new BoxObject({
            id: 'b',
            position: { x: 0, y: 0 },
            size: { width: 1000, height: 1000 },
            title: 'Start',
        });
        const spec = box.toSpec();
        const text = spec.kind === 'group' ? spec.children.find((c) => c.kind === 'text') : undefined;
        expect(text).toMatchObject({ fontSize: 13 });
    });

    it('round-trips through JSON', () => {
        const box = new BoxObject({
            id: 'b',
            position: { x: 1, y: 2 },
            size: { width: 3, height: 4 },
            title: 't',
            subtitle: 's',
        });
        expect(BoxObject.fromJSON(box.toJSON()).toJSON()).toEqual(box.toJSON());
    });
});

describe('EdgeObject', () => {
    const boxAt = (id: string, x: number, y: number) =>
        new BoxObject({ id, position: { x, y }, size: { width: 100, height: 40 } });

    /** The whole point of side-aware anchoring: the head lands on the border, not under it. */
    it('clips its ends to the endpoints’ borders', () => {
        const source = boxAt('a', 0, 0);
        const target = boxAt('b', 400, 0);
        const edge = new EdgeObject({ id: 'e', source, target });

        const { from, to } = edge.anchors;
        expect(from.x).toBeCloseTo(100, 6);
        expect(to.x).toBeGreaterThan(395);
        expect(to.x).toBeLessThan(400);
    });

    it('follows its endpoints when one moves', () => {
        const source = boxAt('a', 0, 0);
        const target = boxAt('b', 400, 0);
        const edge = new EdgeObject({ id: 'e', source, target });
        const before = edge.anchors.to.x;

        target.position = { x: 800, y: 0 };
        expect(edge.anchors.to.x).toBeGreaterThan(before);
    });

    it('anchors on the top or bottom when the boxes are stacked', () => {
        const source = boxAt('a', 0, 0);
        const target = boxAt('b', 0, 400);
        const edge = new EdgeObject({ id: 'e', source, target });
        expect(edge.anchors.from.y).toBeCloseTo(40, 6);
        expect(edge.anchors.from.x).toBeCloseTo(50, 6);
    });

    it('hit-tests as a line, not a bounding box', () => {
        const edge = new EdgeObject({ id: 'e', source: boxAt('a', 0, 0), target: boxAt('b', 400, 400) });
        const { from, to } = edge.anchors;
        const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };

        expect(edge.hitTest(midpoint, 2)).toBe(true);
        // Inside the box the edge spans, far from the line itself.
        expect(edge.hitTest({ x: from.x, y: to.y }, 2)).toBe(false);
    });

    it('draws a self-loop rather than a zero-length line', () => {
        const box = boxAt('a', 0, 0);
        const edge = new EdgeObject({ id: 'e', source: box, target: box });
        expect(edge.isSelfLoop).toBe(true);
        const { from, to } = edge.anchors;
        expect(from.x).not.toBe(to.x);
    });

    it('survives a zero-size endpoint', () => {
        const point = new BoxObject({ id: 'a', position: { x: 0, y: 0 }, size: { width: 0, height: 0 } });
        const edge = new EdgeObject({ id: 'e', source: point, target: boxAt('b', 100, 0) });
        expect(Number.isFinite(edge.anchors.from.x)).toBe(true);
    });

    it('resolves its endpoints by id when rebuilt from JSON', () => {
        const source = boxAt('a', 0, 0);
        const target = boxAt('b', 400, 0);
        const edge = new EdgeObject({ id: 'e', source, target });
        const lookup = new Map([
            ['a', source],
            ['b', target],
        ]);

        const clone = EdgeObject.fromJSON(edge.toJSON(), (id) => lookup.get(id));
        expect(clone?.source).toBe(source);
        expect(EdgeObject.fromJSON(edge.toJSON(), () => undefined)).toBeNull();
    });
});

describe('NoteObject', () => {
    it('centres its box on its position', () => {
        const note = new NoteObject({ id: 'n', position: { x: 100, y: 100 }, text: 'River' });
        const box = note.bounds;
        expect((box.min.x + box.max.x) / 2).toBeCloseTo(100, 6);
        expect((box.min.y + box.max.y) / 2).toBeCloseTo(100, 6);
    });

    /** The world extent of screen-sized text depends on the zoom. */
    it('grows its world box as the view zooms out', () => {
        const note = new NoteObject({ id: 'n', position: { x: 0, y: 0 }, text: 'River' });
        note.setMeasuredScreenSize({ width: 60, height: 20 });

        note.setPixelSize({ width: 1, height: 1 });
        const atOneToOne = note.bounds.max.x - note.bounds.min.x;

        note.setPixelSize({ width: 4, height: 4 });
        expect(note.bounds.max.x - note.bounds.min.x).toBeCloseTo(atOneToOne * 4, 6);
    });

    it('uses a measurement in preference to its estimate', () => {
        const note = new NoteObject({ id: 'n', position: { x: 0, y: 0 }, text: 'River' });
        const estimated = note.bounds.max.x - note.bounds.min.x;
        note.setMeasuredScreenSize({ width: estimated * 10, height: 20 });
        expect(note.bounds.max.x - note.bounds.min.x).toBeCloseTo(estimated * 10, 6);
    });

    it('re-measures when the text changes', () => {
        const note = new NoteObject({ id: 'n', position: { x: 0, y: 0 }, text: 'a' });
        note.setMeasuredScreenSize({ width: 500, height: 20 });
        note.text = 'a much longer piece of text';
        // The stale measurement is dropped, so the box falls back to the estimate.
        expect(note.bounds.max.x - note.bounds.min.x).toBeLessThan(500);
    });

    it('accounts for rotation in its bounds', () => {
        const note = new NoteObject({ id: 'n', position: { x: 0, y: 0 }, text: 'River' });
        note.setMeasuredScreenSize({ width: 100, height: 10 });
        const flat = note.bounds.max.y - note.bounds.min.y;
        note.rotation = 90;
        expect(note.bounds.max.y - note.bounds.min.y).toBeGreaterThan(flat);
    });

    it('round-trips through JSON', () => {
        const note = new NoteObject({ id: 'n', position: { x: 1, y: 2 }, text: 'River', rotation: 30 });
        expect(NoteObject.fromJSON(note.toJSON()).toJSON()).toEqual(note.toJSON());
    });
});

describe('BrushStroke', () => {
    it('stores flat [x, y, …]', () => {
        const stroke = new BrushStroke({ id: 's' });
        stroke.addPoint({ x: 1, y: 2 });
        stroke.addPoint({ x: 3, y: 4 });
        expect(stroke.points).toEqual([1, 2, 3, 4]);
        expect(stroke.pointCount).toBe(2);
    });

    /** §4.3's mitigations, applied before anything can be persisted. */
    it('rounds and simplifies on finish', () => {
        const stroke = new BrushStroke({ id: 's' });
        for (let i = 0; i < 100; i++) stroke.addPoint({ x: i + 0.4, y: 0.6 });

        const before = stroke.pointCount;
        const after = stroke.finish(1);
        expect(after).toBeLessThan(before);
        expect(after).toBe(2);
        expect(stroke.points.every((value) => Number.isInteger(value))).toBe(true);
    });

    it('is idempotent when finished twice', () => {
        const stroke = new BrushStroke({ id: 's' });
        for (let i = 0; i < 50; i++) stroke.addPoint({ x: i, y: Math.sin(i) * 10 });
        stroke.finish(1);
        const once = [...stroke.points];
        stroke.finish(1);
        expect([...stroke.points]).toEqual(once);
    });

    it('keeps the corners of a real shape', () => {
        const stroke = new BrushStroke({ id: 's' });
        stroke.addPoint({ x: 0, y: 0 });
        stroke.addPoint({ x: 50, y: 100 });
        stroke.addPoint({ x: 100, y: 0 });
        expect(stroke.finish(1)).toBe(3);
    });

    it('hit-tests along the line, not across its bounding box', () => {
        const stroke = new BrushStroke({ id: 's', points: [0, 0, 100, 100], width: 4 });
        expect(stroke.hitTest({ x: 50, y: 50 })).toBe(true);
        expect(stroke.hitTest({ x: 0, y: 100 })).toBe(false);
    });

    it('includes half its width in its bounds', () => {
        const stroke = new BrushStroke({ id: 's', points: [0, 0, 100, 0], width: 10 });
        expect(stroke.bounds.min.y).toBe(-5);
    });

    it('translates every coordinate', () => {
        const stroke = new BrushStroke({ id: 's', points: [0, 0, 10, 10] });
        stroke.translate({ x: 5, y: 5 });
        expect(stroke.points).toEqual([5, 5, 15, 15]);
    });

    /** Brush strokes are map content, so unlike every outline they scale with the map. */
    it('draws with a world-scaled stroke width', () => {
        const spec = new BrushStroke({ id: 's', points: [0, 0, 1, 1] }).toSpec();
        expect(spec).toMatchObject({ kind: 'line', strokeScaleEnabled: true });
    });

    it('round-trips through JSON', () => {
        const stroke = new BrushStroke({ id: 's', points: [1, 2, 3, 4], color: '#fff', width: 7 });
        expect(BrushStroke.fromJSON(stroke.toJSON()).toJSON()).toEqual(stroke.toJSON());
    });
});

describe('ImageObject', () => {
    it('is not selectable or draggable by default', () => {
        const image = new ImageObject({
            id: 'i',
            position: { x: 0, y: 0 },
            size: { width: 10, height: 10 },
            src: 'x.png',
        });
        expect(image.selectable).toBe(false);
        expect(image.draggable).toBe(false);
        expect(image.layer).toBe('background');
    });

    it('lets a caller opt in', () => {
        const image = new ImageObject({
            id: 'i',
            position: { x: 0, y: 0 },
            size: { width: 10, height: 10 },
            src: 'x.png',
            selectable: true,
            layer: 'content',
        });
        expect(image.selectable).toBe(true);
        expect(image.layer).toBe('content');
    });

    it('round-trips through JSON', () => {
        const image = new ImageObject({
            id: 'i',
            position: { x: 1, y: 2 },
            size: { width: 3, height: 4 },
            src: 'x.png',
        });
        expect(ImageObject.fromJSON(image.toJSON()).toJSON()).toEqual(image.toJSON());
    });
});
