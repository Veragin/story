import type { TPoint } from '@story/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { History } from '../src/history/History';
import { Navigation } from '../src/interaction/Navigation';
import { Selection } from '../src/interaction/Selection';
import { Snapping } from '../src/interaction/Snapping';
import { BoxObject } from '../src/objects/BoxObject';
import { BrushStroke } from '../src/objects/BrushStroke';
import { NoteObject } from '../src/objects/NoteObject';
import { PolygonObject } from '../src/objects/PolygonObject';
import { FakeRenderer } from '../src/renderer/FakeRenderer';
import { Scene } from '../src/scene/Scene';
import { BrushTool } from '../src/tools/BrushTool';
import { NoteTool } from '../src/tools/NoteTool';
import { PolygonDrawTool } from '../src/tools/PolygonDrawTool';
import { SelectTool } from '../src/tools/SelectTool';
import { ToolManager } from '../src/tools/ToolManager';
import { VertexEditTool } from '../src/tools/VertexEditTool';

let renderer: FakeRenderer;
let scene: Scene;
let selection: Selection;
let history: History;
let snapping: Snapping;

const SQUARE = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
];

const mount = () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true });
    document.body.appendChild(container);
    scene.mount(container);
};

/** Drives a full press-move-release gesture through the renderer. */
const drag = (from: TPoint, to: TPoint, options: { shiftKey?: boolean; altKey?: boolean } = {}) => {
    renderer.emitPointer({ type: 'down', world: from, screen: from, ...options });
    renderer.emitPointer({ type: 'move', world: to, screen: to, ...options });
    renderer.emitPointer({ type: 'up', world: to, screen: to, ...options });
};

const click = (at: TPoint, options: { shiftKey?: boolean; altKey?: boolean } = {}) => {
    renderer.emitPointer({ type: 'down', world: at, screen: at, ...options });
    renderer.emitPointer({ type: 'up', world: at, screen: at, ...options });
};

beforeEach(() => {
    document.body.innerHTML = '';
    renderer = new FakeRenderer();
    scene = new Scene({ renderer });
    selection = new Selection();
    history = new History();
    // Snapping off by default: each test that cares turns on the part it is testing.
    snapping = new Snapping({ gridSize: 0, vertexThreshold: 0, closeThreshold: 10 });
    mount();
});

const managerWith = (...tools: Parameters<ToolManager['registerAll']>[0]) =>
    new ToolManager({ scene, selection, history, snapping }).registerAll(tools);

describe('Selection', () => {
    it('replaces, adds, removes and toggles', () => {
        const a = scene.add(new BoxObject({ id: 'a', position: { x: 0, y: 0 }, size: { width: 10, height: 10 } }));
        const b = scene.add(new BoxObject({ id: 'b', position: { x: 20, y: 0 }, size: { width: 10, height: 10 } }));

        selection.set([a]);
        expect(selection.all).toEqual([a]);

        selection.add([b]);
        expect(selection.size).toBe(2);

        selection.toggle([a]);
        expect(selection.all).toEqual([b]);

        selection.remove([b]);
        expect(selection.isEmpty).toBe(true);
    });

    it('mirrors itself onto the objects’ selected flags', () => {
        const box = scene.add(new BoxObject({ id: 'a', position: { x: 0, y: 0 }, size: { width: 10, height: 10 } }));
        selection.set([box]);
        expect(box.selected).toBe(true);
        selection.clear();
        expect(box.selected).toBe(false);
    });

    it('refuses unselectable objects', () => {
        const box = scene.add(
            new BoxObject({ id: 'a', position: { x: 0, y: 0 }, size: { width: 10, height: 10 }, selectable: false })
        );
        selection.set([box]);
        expect(selection.isEmpty).toBe(true);
    });

    it('does not notify when the selection would not change', () => {
        const box = scene.add(new BoxObject({ id: 'a', position: { x: 0, y: 0 }, size: { width: 10, height: 10 } }));
        selection.set([box]);
        const listener = vi.fn();
        selection.onChange.subscribe(listener);
        selection.set([box]);
        expect(listener).not.toHaveBeenCalled();
    });

    /** Without pruning, a deleted object stays selected and stays alive. */
    it('prunes objects that left the scene', () => {
        const box = scene.add(new BoxObject({ id: 'a', position: { x: 0, y: 0 }, size: { width: 10, height: 10 } }));
        selection.set([box]);
        scene.remove(box);
        selection.prune((object) => scene.get(object.id) !== undefined);
        expect(selection.isEmpty).toBe(true);
    });

    it('reports a single selection only when there is exactly one', () => {
        const a = scene.add(new BoxObject({ id: 'a', position: { x: 0, y: 0 }, size: { width: 10, height: 10 } }));
        const b = scene.add(new BoxObject({ id: 'b', position: { x: 20, y: 0 }, size: { width: 10, height: 10 } }));
        selection.set([a]);
        expect(selection.single).toBe(a);
        selection.add([b]);
        expect(selection.single).toBeUndefined();
    });
});

describe('Snapping', () => {
    it('snaps to the grid', () => {
        const snap = new Snapping({ gridSize: 10, vertexThreshold: 0 });
        expect(snap.snap({ x: 12, y: 27 }).point).toEqual({ x: 10, y: 30 });
    });

    /** A shared corner means "these places touch" — information the grid does not have. */
    it('prefers a nearby vertex over the grid', () => {
        const snap = new Snapping({ gridSize: 10, vertexThreshold: 5 });
        const result = snap.snap({ x: 12, y: 27 }, [{ x: 13, y: 26 }]);
        expect(result.kind).toBe('vertex');
        expect(result.point).toEqual({ x: 13, y: 26 });
    });

    it('falls back to the grid when no vertex is close enough', () => {
        const snap = new Snapping({ gridSize: 10, vertexThreshold: 1 });
        expect(snap.snap({ x: 12, y: 27 }, [{ x: 50, y: 50 }]).kind).toBe('grid');
    });

    it('does nothing when disabled', () => {
        const snap = new Snapping({ gridSize: 10, enabled: false });
        expect(snap.snap({ x: 12, y: 27 })).toEqual({ point: { x: 12, y: 27 }, kind: 'none' });
    });

    it('closes a ring only once it has enough vertices', () => {
        const snap = new Snapping({ closeThreshold: 10 });
        const first = { x: 0, y: 0 };
        expect(snap.shouldClose({ x: 2, y: 2 }, first, 2)).toBe(false);
        expect(snap.shouldClose({ x: 2, y: 2 }, first, 3)).toBe(true);
        expect(snap.shouldClose({ x: 50, y: 50 }, first, 5)).toBe(false);
    });
});

describe('SelectTool', () => {
    const addBox = (id: string, x: number, y: number) =>
        scene.add(new BoxObject({ id, position: { x, y }, size: { width: 100, height: 50 } }));

    it('selects on click and clears on empty space', () => {
        const tool = new SelectTool();
        managerWith(tool);
        const box = addBox('a', 0, 0);

        click({ x: 50, y: 25 });
        expect(selection.all).toEqual([box]);

        click({ x: 500, y: 500 });
        expect(selection.isEmpty).toBe(true);
    });

    it('adds and removes with shift-click', () => {
        managerWith(new SelectTool());
        const a = addBox('a', 0, 0);
        const b = addBox('b', 200, 0);

        click({ x: 50, y: 25 });
        click({ x: 250, y: 25 }, { shiftKey: true });
        expect(selection.size).toBe(2);

        click({ x: 250, y: 25 }, { shiftKey: true });
        expect(selection.all).toEqual([a]);
        expect(selection.has(b)).toBe(false);
    });

    /** The threshold exists so clicking does not nudge; without it every select moves. */
    it('does not move an object on a click', () => {
        managerWith(new SelectTool());
        const box = addBox('a', 0, 0);

        renderer.emitPointer({ type: 'down', world: { x: 50, y: 25 }, screen: { x: 50, y: 25 } });
        renderer.emitPointer({ type: 'move', world: { x: 51, y: 25 }, screen: { x: 51, y: 25 } });
        renderer.emitPointer({ type: 'up', world: { x: 51, y: 25 }, screen: { x: 51, y: 25 } });

        expect(box.position).toEqual({ x: 0, y: 0 });
        expect(history.canUndo).toBe(false);
    });

    it('drags past the threshold and records one undo entry', () => {
        managerWith(new SelectTool());
        const box = addBox('a', 0, 0);

        renderer.emitPointer({ type: 'down', world: { x: 50, y: 25 }, screen: { x: 50, y: 25 } });
        for (let i = 1; i <= 20; i++) {
            renderer.emitPointer({ type: 'move', world: { x: 50 + i * 5, y: 25 }, screen: { x: 50 + i * 5, y: 25 } });
        }
        renderer.emitPointer({ type: 'up', world: { x: 150, y: 25 }, screen: { x: 150, y: 25 } });

        expect(box.position.x).toBe(100);
        expect(history.undoLabels).toHaveLength(1);

        history.undo();
        expect(box.position).toEqual({ x: 0, y: 0 });
    });

    it('drags a whole multi-selection together', () => {
        managerWith(new SelectTool());
        const a = addBox('a', 0, 0);
        const b = addBox('b', 300, 0);

        click({ x: 50, y: 25 });
        click({ x: 350, y: 25 }, { shiftKey: true });
        drag({ x: 50, y: 25 }, { x: 150, y: 25 });

        expect(a.position.x).toBe(100);
        expect(b.position.x).toBe(400);
        expect(history.undoLabels).toHaveLength(1);
    });

    it('marquee-selects what lies wholly inside', () => {
        managerWith(new SelectTool());
        const inside = addBox('inside', 10, 10);
        addBox('straddling', 700, 10);

        drag({ x: 0, y: 0 }, { x: 400, y: 400 });
        expect(selection.all).toEqual([inside]);
    });

    it('removes the marquee from the scene when the gesture ends', () => {
        managerWith(new SelectTool());
        drag({ x: 0, y: 0 }, { x: 400, y: 400 });
        expect(scene.all().some((object) => object.type === 'marquee')).toBe(false);
    });

    it('opens on double-click', () => {
        const tool = new SelectTool();
        managerWith(tool);
        const box = addBox('a', 0, 0);
        const listener = vi.fn();
        tool.onOpen.subscribe(listener);

        renderer.emitPointer({ type: 'dblclick', world: { x: 50, y: 25 } });
        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener.mock.calls[0][0].object).toBe(box);
    });

    it('deletes the selection as one undoable entry', () => {
        managerWith(new SelectTool());
        addBox('a', 0, 0);
        addBox('b', 300, 0);
        selection.set(scene.all());

        renderer.emitKey({ key: 'Delete' });
        expect(scene.all()).toHaveLength(0);

        history.undo();
        expect(scene.all()).toHaveLength(2);
    });

    it('selects everything on Ctrl+A', () => {
        managerWith(new SelectTool());
        addBox('a', 0, 0);
        addBox('b', 300, 0);

        renderer.emitKey({ key: 'a', ctrlKey: true });
        expect(selection.size).toBe(2);
    });

    it('never selects overlay furniture', () => {
        managerWith(new SelectTool());
        scene.add(
            new BoxObject({
                id: 'handle',
                position: { x: 0, y: 0 },
                size: { width: 100, height: 50 },
                layer: 'overlay',
            })
        );
        click({ x: 50, y: 25 });
        expect(selection.isEmpty).toBe(true);
    });

    it('honours a filter', () => {
        managerWith(new SelectTool({ filter: (object) => object.id !== 'a' }));
        addBox('a', 0, 0);
        click({ x: 50, y: 25 });
        expect(selection.isEmpty).toBe(true);
    });

    it('puts everything back when a drag is cancelled', () => {
        const tool = new SelectTool();
        managerWith(tool);
        const box = addBox('a', 0, 0);

        renderer.emitPointer({ type: 'down', world: { x: 50, y: 25 }, screen: { x: 50, y: 25 } });
        renderer.emitPointer({ type: 'move', world: { x: 200, y: 25 }, screen: { x: 200, y: 25 } });
        tool.cancel();

        expect(box.position).toEqual({ x: 0, y: 0 });
        expect(history.canUndo).toBe(false);
    });
});

describe('PolygonDrawTool', () => {
    it('builds a ring click by click and closes on the first vertex', () => {
        const tool = new PolygonDrawTool({ generateId: () => 'drawn' });
        const manager = managerWith(new SelectTool(), tool);
        manager.activate('polygon-draw');

        const created = vi.fn();
        tool.onCreated.subscribe(created);

        click({ x: 0, y: 0 });
        click({ x: 100, y: 0 });
        click({ x: 100, y: 100 });
        click({ x: 2, y: 2 });

        expect(created).toHaveBeenCalledTimes(1);
        const polygon = scene.get('drawn');
        expect(polygon).toBeInstanceOf(PolygonObject);
        expect((polygon as PolygonObject).vertexCount).toBe(3);
    });

    it('closes on Enter', () => {
        const tool = new PolygonDrawTool({ generateId: () => 'drawn' });
        managerWith(new SelectTool(), tool).activate('polygon-draw');

        click({ x: 0, y: 0 });
        click({ x: 100, y: 0 });
        click({ x: 100, y: 100 });
        renderer.emitKey({ key: 'Enter' });

        expect(scene.get('drawn')).toBeDefined();
    });

    it('refuses to close below three vertices', () => {
        const tool = new PolygonDrawTool({ generateId: () => 'drawn' });
        managerWith(new SelectTool(), tool).activate('polygon-draw');

        click({ x: 0, y: 0 });
        click({ x: 100, y: 0 });
        renderer.emitKey({ key: 'Enter' });

        expect(scene.get('drawn')).toBeUndefined();
        expect(tool.vertexCount).toBe(2);
    });

    /** An abandoned drawing must not leave its preview or its handles behind. */
    it('leaves nothing behind when cancelled', () => {
        const tool = new PolygonDrawTool();
        const manager = managerWith(new SelectTool(), tool);
        manager.activate('polygon-draw');

        click({ x: 0, y: 0 });
        click({ x: 100, y: 0 });
        expect(scene.all().length).toBeGreaterThan(0);

        renderer.emitKey({ key: 'Escape' });
        expect(scene.all()).toHaveLength(0);
    });

    it('drops the last vertex on Backspace', () => {
        const tool = new PolygonDrawTool();
        managerWith(new SelectTool(), tool).activate('polygon-draw');

        click({ x: 0, y: 0 });
        click({ x: 100, y: 0 });
        renderer.emitKey({ key: 'Backspace' });
        expect(tool.vertexCount).toBe(1);
    });

    it('is undoable', () => {
        const tool = new PolygonDrawTool({ generateId: () => 'drawn' });
        managerWith(new SelectTool(), tool).activate('polygon-draw');

        click({ x: 0, y: 0 });
        click({ x: 100, y: 0 });
        click({ x: 100, y: 100 });
        renderer.emitKey({ key: 'Enter' });

        expect(scene.get('drawn')).toBeDefined();
        history.undo();
        expect(scene.get('drawn')).toBeUndefined();
    });

    it('selects the polygon it just created', () => {
        const tool = new PolygonDrawTool({ generateId: () => 'drawn' });
        managerWith(new SelectTool(), tool).activate('polygon-draw');

        click({ x: 0, y: 0 });
        click({ x: 100, y: 0 });
        click({ x: 100, y: 100 });
        renderer.emitKey({ key: 'Enter' });

        expect(selection.single?.id).toBe('drawn');
    });

    it('reports a self-intersecting result rather than refusing it', () => {
        const tool = new PolygonDrawTool({ generateId: () => 'bowtie' });
        managerWith(new SelectTool(), tool).activate('polygon-draw');

        const created = vi.fn();
        tool.onCreated.subscribe(created);

        click({ x: 0, y: 0 });
        click({ x: 100, y: 100 });
        click({ x: 100, y: 0 });
        click({ x: 0, y: 100 });
        renderer.emitKey({ key: 'Enter' });

        expect(created.mock.calls[0][0].selfIntersecting).toBe(true);
    });

    it('snaps a new vertex onto an existing polygon’s corner', () => {
        snapping.vertexThreshold = 10;
        const tool = new PolygonDrawTool({ generateId: () => 'drawn' });
        managerWith(new SelectTool(), tool).activate('polygon-draw');
        scene.add(new PolygonObject({ id: 'existing', points: SQUARE }));

        click({ x: 103, y: 3 });
        click({ x: 300, y: 0 });
        click({ x: 300, y: 300 });
        renderer.emitKey({ key: 'Enter' });

        const drawn = scene.get('drawn') as PolygonObject;
        expect(drawn.points).toContainEqual({ x: 100, y: 0 });
    });

    it('suspends snapping while alt is held', () => {
        snapping.vertexThreshold = 50;
        const tool = new PolygonDrawTool({ generateId: () => 'drawn' });
        managerWith(new SelectTool(), tool).activate('polygon-draw');
        scene.add(new PolygonObject({ id: 'existing', points: SQUARE }));

        click({ x: 103, y: 3 }, { altKey: true });
        click({ x: 300, y: 0 }, { altKey: true });
        click({ x: 300, y: 300 }, { altKey: true });
        renderer.emitKey({ key: 'Enter' });

        expect((scene.get('drawn') as PolygonObject).points).toContainEqual({ x: 103, y: 3 });
    });
});

describe('VertexEditTool', () => {
    const polygonAt = () => scene.add(new PolygonObject({ id: 'p', points: SQUARE }));

    it('shows handles for the polygon it is pointed at', () => {
        const tool = new VertexEditTool();
        managerWith(new SelectTool(), tool).activate('vertex-edit');
        const polygon = polygonAt();

        tool.setTarget(polygon);
        expect(scene.all().some((object) => object.type === 'vertex-handles')).toBe(true);
    });

    it('drags a vertex and records one undo entry', () => {
        const tool = new VertexEditTool();
        managerWith(new SelectTool(), tool).activate('vertex-edit');
        const polygon = polygonAt();
        tool.setTarget(polygon);

        drag({ x: 0, y: 0 }, { x: -50, y: -50 });

        expect(polygon.points).toContainEqual({ x: -50, y: -50 });
        expect(history.undoLabels).toEqual(['Move vertex']);

        history.undo();
        expect(polygon.points).toContainEqual({ x: 0, y: 0 });
    });

    it('inserts a vertex when the outline is clicked', () => {
        const tool = new VertexEditTool();
        managerWith(new SelectTool(), tool).activate('vertex-edit');
        const polygon = polygonAt();
        tool.setTarget(polygon);

        click({ x: 50, y: 0 });
        expect(polygon.vertexCount).toBe(5);

        history.undo();
        expect(polygon.vertexCount).toBe(4);
    });

    it('deletes a vertex on alt-click', () => {
        const tool = new VertexEditTool();
        managerWith(new SelectTool(), tool).activate('vertex-edit');
        const polygon = scene.add(new PolygonObject({ id: 'p', points: [...SQUARE, { x: -50, y: 50 }] }));
        tool.setTarget(polygon);

        const before = polygon.vertexCount;
        click({ x: 0, y: 0 }, { altKey: true });
        expect(polygon.vertexCount).toBe(before - 1);
    });

    it('refuses to delete below three vertices', () => {
        const tool = new VertexEditTool();
        managerWith(new SelectTool(), tool).activate('vertex-edit');
        const triangle = scene.add(
            new PolygonObject({
                id: 'p',
                points: [
                    { x: 0, y: 0 },
                    { x: 100, y: 0 },
                    { x: 50, y: 100 },
                ],
            })
        );
        tool.setTarget(triangle);

        click({ x: 0, y: 0 }, { altKey: true });
        expect(triangle.vertexCount).toBe(3);
        expect(history.canUndo).toBe(false);
    });

    it('restores the ring when a vertex drag is cancelled', () => {
        const tool = new VertexEditTool();
        managerWith(new SelectTool(), tool).activate('vertex-edit');
        const polygon = polygonAt();
        tool.setTarget(polygon);

        renderer.emitPointer({ type: 'down', world: { x: 0, y: 0 }, screen: { x: 0, y: 0 } });
        renderer.emitPointer({ type: 'move', world: { x: -80, y: -80 }, screen: { x: -80, y: -80 } });
        tool.cancel();

        expect(polygon.points).toContainEqual({ x: 0, y: 0 });
        expect(history.canUndo).toBe(false);
    });

    it('records nothing when a drag ends where it began', () => {
        const tool = new VertexEditTool();
        managerWith(new SelectTool(), tool).activate('vertex-edit');
        const polygon = polygonAt();
        tool.setTarget(polygon);

        drag({ x: 0, y: 0 }, { x: 0, y: 0 });
        expect(history.canUndo).toBe(false);
    });

    it('removes its handles when it is deactivated', () => {
        const tool = new VertexEditTool();
        const manager = managerWith(new SelectTool(), tool);
        manager.activate('vertex-edit');
        tool.setTarget(polygonAt());

        manager.activate('select');
        expect(scene.all().some((object) => object.type === 'vertex-handles')).toBe(false);
    });

    it('adopts the current selection on activation', () => {
        const tool = new VertexEditTool();
        const manager = managerWith(new SelectTool(), tool);
        const polygon = polygonAt();
        selection.set([polygon]);

        manager.activate('vertex-edit');
        expect(tool.editing).toBe(polygon);
    });
});

describe('BrushTool', () => {
    it('draws a stroke on hold and simplifies it on release', () => {
        const tool = new BrushTool({ generateId: () => 'stroke', minimumSampleDistance: 1 });
        managerWith(new SelectTool(), tool).activate('brush');

        const created = vi.fn();
        tool.onCreated.subscribe(created);

        renderer.emitPointer({ type: 'down', world: { x: 0, y: 0 } });
        for (let i = 1; i <= 60; i++) renderer.emitPointer({ type: 'move', world: { x: i * 2, y: 0 } });
        renderer.emitPointer({ type: 'up', world: { x: 120, y: 0 } });

        const stroke = scene.get('stroke') as BrushStroke;
        expect(stroke).toBeInstanceOf(BrushStroke);
        // A straight line collapses to its endpoints — the §4.3 mitigation.
        expect(stroke.pointCount).toBe(2);
        expect(created).toHaveBeenCalledTimes(1);
    });

    it('discards a stroke that was really a click', () => {
        const tool = new BrushTool({ generateId: () => 'stroke' });
        managerWith(new SelectTool(), tool).activate('brush');

        renderer.emitPointer({ type: 'down', world: { x: 10, y: 10 } });
        renderer.emitPointer({ type: 'up', world: { x: 10, y: 10 } });

        expect(scene.get('stroke')).toBeUndefined();
        expect(history.canUndo).toBe(false);
    });

    it('ignores samples closer together than the minimum distance', () => {
        const tool = new BrushTool({ generateId: () => 'stroke', minimumSampleDistance: 10 });
        managerWith(new SelectTool(), tool).activate('brush');

        renderer.emitPointer({ type: 'down', world: { x: 0, y: 0 } });
        for (let i = 1; i <= 50; i++) renderer.emitPointer({ type: 'move', world: { x: i * 0.1, y: 0 } });
        renderer.emitPointer({ type: 'up', world: { x: 5, y: 0 } });

        // Fifty moves, none of them 10 units from the last, so none were recorded: what
        // survives is the press and the release. The stroke is still real — it covers five
        // world units — it is just not fifty points long.
        const stroke = scene.get('stroke') as BrushStroke;
        expect(stroke.pointCount).toBe(2);
    });

    it('is undoable', () => {
        const tool = new BrushTool({ generateId: () => 'stroke', minimumSampleDistance: 1 });
        managerWith(new SelectTool(), tool).activate('brush');

        renderer.emitPointer({ type: 'down', world: { x: 0, y: 0 } });
        renderer.emitPointer({ type: 'move', world: { x: 50, y: 50 } });
        renderer.emitPointer({ type: 'up', world: { x: 100, y: 0 } });

        expect(scene.get('stroke')).toBeDefined();
        history.undo();
        expect(scene.get('stroke')).toBeUndefined();
    });

    it('removes an abandoned stroke on cancel', () => {
        const tool = new BrushTool({ generateId: () => 'stroke', minimumSampleDistance: 1 });
        managerWith(new SelectTool(), tool).activate('brush');

        renderer.emitPointer({ type: 'down', world: { x: 0, y: 0 } });
        renderer.emitPointer({ type: 'move', world: { x: 50, y: 50 } });
        tool.cancel();

        expect(scene.get('stroke')).toBeUndefined();
        expect(history.canUndo).toBe(false);
    });

    it('uses the tool’s current colour and width', () => {
        const tool = new BrushTool({ generateId: () => 'stroke', minimumSampleDistance: 1 });
        managerWith(new SelectTool(), tool).activate('brush');
        tool.color = '#ff0000';
        tool.width = 12;

        renderer.emitPointer({ type: 'down', world: { x: 0, y: 0 } });
        renderer.emitPointer({ type: 'move', world: { x: 50, y: 50 } });
        renderer.emitPointer({ type: 'up', world: { x: 100, y: 0 } });

        const stroke = scene.get('stroke') as BrushStroke;
        expect(stroke.color).toBe('#ff0000');
        expect(stroke.width).toBe(12);
    });
});

describe('NoteTool', () => {
    it('asks the host for text rather than editing on the canvas', () => {
        const tool = new NoteTool({ generateId: () => 'note' });
        managerWith(new SelectTool(), tool).activate('note');

        const requests: { commit: (text: string) => void; isNew: boolean }[] = [];
        tool.onEditRequested.subscribe((request) => requests.push(request));

        renderer.emitPointer({ type: 'down', world: { x: 50, y: 50 } });
        expect(requests).toHaveLength(1);
        expect(requests[0].isNew).toBe(true);

        requests[0].commit('River Nen');
        expect((scene.get('note') as NoteObject).text).toBe('River Nen');
    });

    it('discards a new note committed empty', () => {
        const tool = new NoteTool({ generateId: () => 'note' });
        managerWith(new SelectTool(), tool).activate('note');

        let commit!: (text: string) => void;
        tool.onEditRequested.subscribe((request) => (commit = request.commit));

        renderer.emitPointer({ type: 'down', world: { x: 50, y: 50 } });
        commit('   ');
        expect(scene.get('note')).toBeUndefined();
    });

    it('discards a new note when the edit is cancelled', () => {
        const tool = new NoteTool({ generateId: () => 'note' });
        managerWith(new SelectTool(), tool).activate('note');

        let cancel!: () => void;
        tool.onEditRequested.subscribe((request) => (cancel = request.cancel));

        renderer.emitPointer({ type: 'down', world: { x: 50, y: 50 } });
        cancel();
        expect(scene.get('note')).toBeUndefined();
    });

    it('edits an existing note instead of stacking a new one on it', () => {
        const tool = new NoteTool({ generateId: () => 'note-2' });
        managerWith(new SelectTool(), tool).activate('note');
        const existing = scene.add(new NoteObject({ id: 'note-1', position: { x: 50, y: 50 }, text: 'Old' }));

        const requests: { isNew: boolean; commit: (text: string) => void }[] = [];
        tool.onEditRequested.subscribe((request) => requests.push(request));

        renderer.emitPointer({ type: 'down', world: { x: 50, y: 50 } });
        expect(requests[0].isNew).toBe(false);

        requests[0].commit('New');
        expect(existing.text).toBe('New');

        history.undo();
        expect(existing.text).toBe('Old');
    });

    it('deletes an existing note whose text is cleared', () => {
        const tool = new NoteTool();
        managerWith(new SelectTool(), tool).activate('note');
        const existing = scene.add(new NoteObject({ id: 'note-1', position: { x: 50, y: 50 }, text: 'Old' }));

        let commit!: (text: string) => void;
        tool.onEditRequested.subscribe((request) => (commit = request.commit));

        tool.edit(existing);
        commit('');
        expect(scene.get('note-1')).toBeUndefined();

        history.undo();
        expect(scene.get('note-1')).toBeDefined();
    });

    /**
     * A note is added to the scene the moment it is placed, so the author can see where it will
     * land while they type — which makes it visible to anything walking the scene. It therefore
     * sits on `overlay` (tool furniture, never content) until it has real text.
     *
     * Without this, a host that saved the map while the dialog was open wrote the placeholder
     * into `data/` as a real note — which is exactly what happened before this test existed.
     */
    it('keeps an uncommitted note on the overlay layer, out of the content', () => {
        const tool = new NoteTool({ generateId: () => 'note' });
        managerWith(new SelectTool(), tool).activate('note');

        let commit!: (text: string) => void;
        tool.onEditRequested.subscribe((request) => (commit = request.commit));

        renderer.emitPointer({ type: 'down', world: { x: 50, y: 50 } });

        const pending = scene.get('note') as NoteObject;
        expect(pending.layer).toBe('overlay');
        expect(pending.selectable).toBe(false);

        commit('River Nen');
        const committed = scene.get('note') as NoteObject;
        expect(committed.layer).toBe('content');
        expect(committed.selectable).toBe(true);
        expect(committed.text).toBe('River Nen');
    });

    it('leaves an edited existing note on the content layer', () => {
        const tool = new NoteTool();
        managerWith(new SelectTool(), tool).activate('note');
        const existing = scene.add(new NoteObject({ id: 'note-1', position: { x: 50, y: 50 }, text: 'Old' }));

        let commit!: (text: string) => void;
        tool.onEditRequested.subscribe((request) => (commit = request.commit));

        tool.edit(existing);
        commit('New');
        expect(existing.layer).toBe('content');
    });

    it('removes a note left waiting for text when cancelled', () => {
        const tool = new NoteTool({ generateId: () => 'note' });
        managerWith(new SelectTool(), tool).activate('note');
        tool.onEditRequested.subscribe(() => {});

        renderer.emitPointer({ type: 'down', world: { x: 50, y: 50 } });
        tool.cancel();
        expect(scene.get('note')).toBeUndefined();
    });
});

describe('ToolManager', () => {
    it('activates the first tool registered', () => {
        const manager = managerWith(new SelectTool(), new BrushTool());
        expect(manager.activeToolName).toBe('select');
    });

    it('cancels the outgoing tool when switching', () => {
        const draw = new PolygonDrawTool();
        const manager = managerWith(new SelectTool(), draw, new BrushTool());
        manager.activate('polygon-draw');

        click({ x: 0, y: 0 });
        click({ x: 100, y: 0 });
        manager.activate('brush');

        expect(draw.vertexCount).toBe(0);
    });

    it('returns to select on Escape with nothing in progress', () => {
        const manager = managerWith(new SelectTool(), new BrushTool());
        manager.activate('brush');

        renderer.emitKey({ key: 'Escape' });
        expect(manager.activeToolName).toBe('select');
    });

    /** Two-step: the first Escape abandons the drawing, the second leaves the tool. */
    it('cancels the gesture before it leaves the tool', () => {
        const draw = new PolygonDrawTool();
        const manager = managerWith(new SelectTool(), draw);
        manager.activate('polygon-draw');
        click({ x: 0, y: 0 });

        renderer.emitKey({ key: 'Escape' });
        expect(manager.activeToolName).toBe('polygon-draw');
        expect(draw.vertexCount).toBe(0);

        renderer.emitKey({ key: 'Escape' });
        expect(manager.activeToolName).toBe('select');
    });

    it('sets the cursor from the active tool', () => {
        const manager = managerWith(new SelectTool(), new BrushTool());
        manager.activate('brush');
        expect(renderer.cursor).toBe('crosshair');
    });

    it('ignores keystrokes from a text field', () => {
        const manager = managerWith(new SelectTool(), new BrushTool());
        manager.activate('brush');

        renderer.emitKey({ key: 'Escape', fromTextInput: true });
        expect(manager.activeToolName).toBe('brush');
    });

    it('ignores non-primary buttons, which belong to navigation', () => {
        managerWith(new SelectTool());
        const box = scene.add(new BoxObject({ id: 'a', position: { x: 0, y: 0 }, size: { width: 100, height: 50 } }));

        renderer.emitPointer({ type: 'down', world: { x: 50, y: 25 }, button: 1 });
        expect(selection.isEmpty).toBe(true);
        expect(box.selected).toBe(false);
    });

    it('suppresses tools while a pan is in progress', () => {
        const navigation = new Navigation(scene, { panButtons: [1] });
        const manager = new ToolManager({ scene, selection, history, snapping, navigation });
        manager.register(new SelectTool());
        scene.add(new BoxObject({ id: 'a', position: { x: 0, y: 0 }, size: { width: 100, height: 50 } }));

        renderer.emitPointer({ type: 'down', world: { x: 50, y: 25 }, screen: { x: 50, y: 25 }, button: 1 });
        expect(navigation.isPanning).toBe(true);

        renderer.emitPointer({ type: 'down', world: { x: 50, y: 25 }, screen: { x: 50, y: 25 }, button: 0 });
        expect(selection.isEmpty).toBe(true);
    });

    it('reports an unknown tool rather than switching to nothing', () => {
        const manager = managerWith(new SelectTool());
        expect(manager.activate('nope')).toBe(false);
        expect(manager.activeToolName).toBe('select');
    });

    it('cleans up on destroy', () => {
        const manager = managerWith(new SelectTool());
        manager.destroy();
        scene.add(new BoxObject({ id: 'a', position: { x: 0, y: 0 }, size: { width: 100, height: 50 } }));

        click({ x: 50, y: 25 });
        expect(selection.isEmpty).toBe(true);
    });
});
