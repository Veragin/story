import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Scene, type TSceneEvents } from '../Scene';
import { LineShape } from '../shapes/LineShape';
import { PolygonShape } from '../shapes/PolygonShape';
import { RectShape } from '../shapes/RectShape';
import {
    click,
    createCanvas,
    doubleClick,
    drag,
    fire,
    hover,
    installFrames,
    key,
    uninstallFrames,
} from '../__tests__/helpers';
import { LineTool } from './LineTool';
import { SelectionController } from './SelectionController';
import { VertexEditController } from './VertexEditController';

let canvas: HTMLCanvasElement;
let scene: Scene;
let selection: SelectionController;
let changes: TSceneEvents['change'][];

beforeEach(() => {
    installFrames();
    canvas = createCanvas();
    scene = new Scene(canvas);
    selection = new SelectionController(scene);
    changes = [];
    scene.events.on('change', (c) => changes.push(c));
});

afterEach(() => {
    scene.destroy();
    canvas.remove();
    uninstallFrames();
});

const box = (props: Partial<ConstructorParameters<typeof RectShape>[0]> = {}) =>
    scene.add(new RectShape({ x: 100, y: 100, width: 100, height: 50, draggable: true, ...props }));

describe('SelectionController', () => {
    it('click selects, click on empty space clears, and emits select', () => {
        const r = box();
        const onSelect = vi.fn();
        scene.events.on('select', onSelect);
        click(canvas, 150, 120);
        expect(selection.selected).toBe(r);
        expect(onSelect).toHaveBeenLastCalledWith({ shape: r, previous: null });
        click(canvas, 500, 500);
        expect(selection.selected).toBeNull();
        expect(onSelect).toHaveBeenLastCalledWith({ shape: null, previous: r });
    });

    it('non-selectable shapes are not selected', () => {
        box({ selectable: false });
        click(canvas, 150, 120);
        expect(selection.selected).toBeNull();
    });

    it('only the selected shape drags; dragging an unselected shape pans', () => {
        const r = box();
        drag(canvas, [150, 120], [170, 120]);
        expect(r.x).toBe(100);
        expect(scene.camera.x).toBeCloseTo(-20);
        expect(changes).toHaveLength(0);

        scene.camera.set({ x: 0, y: 0 });
        click(canvas, 150, 120);
        drag(canvas, [150, 120], [180, 140], 3);
        expect(r.rect).toMatchObject({ x: 130, y: 120 });
        expect(scene.camera.x).toBe(0);
        expect(changes.filter((c) => !c.final).length).toBeGreaterThan(0);
        expect(changes[changes.length - 1]).toEqual({ shape: r, kind: 'move', final: true });
        expect(changes.filter((c) => c.final)).toHaveLength(1);
    });

    it('non-draggable selected shapes do not move', () => {
        const r = box({ draggable: false });
        click(canvas, 150, 120);
        drag(canvas, [150, 120], [180, 140]);
        expect(r.x).toBe(100);
    });

    it('drag respects axis and constrain', () => {
        const r = box({ drag: { axis: 'x' } });
        click(canvas, 150, 120);
        drag(canvas, [150, 120], [180, 160]);
        expect(r.rect).toMatchObject({ x: 130, y: 100 });

        r.update({ drag: { constrain: (p) => ({ x: Math.round(p.x / 25) * 25, y: Math.max(0, p.y) }) } });
        drag(canvas, [150, 120], [162, -400]);
        expect(r.rect).toMatchObject({ x: 150, y: 0 });
    });

    it('drag follows the camera zoom', () => {
        const r = box();
        scene.camera.set({ zoom: 2 });
        click(canvas, 300, 240); // world (150, 120)
        drag(canvas, [300, 240], [340, 240]);
        expect(r.x).toBe(120);
    });

    it('resizes rects by their left and right edges', () => {
        const r = box({ resizeEdges: ['left', 'right'], minWidth: 20 });
        click(canvas, 150, 120);
        drag(canvas, [200, 125], [240, 125]);
        expect(r.rect).toEqual({ x: 100, y: 100, width: 140, height: 50 });
        expect(changes[changes.length - 1]).toMatchObject({ kind: 'resize', edge: 'right', final: true });

        drag(canvas, [100, 125], [80, 125]);
        expect(r.rect).toEqual({ x: 80, y: 100, width: 160, height: 50 });

        drag(canvas, [80, 125], [500, 125]); // min width holds, right edge stays
        expect(r.rect).toEqual({ x: 220, y: 100, width: 20, height: 50 });
    });

    it('resize respects constrainResize', () => {
        const r = box({
            resizeEdges: ['right'],
            constrainResize: (rect) => ({ ...rect, width: Math.min(rect.width, 120) }),
        });
        click(canvas, 150, 120);
        drag(canvas, [200, 125], [400, 125]);
        expect(r.width).toBe(120);
    });

    it('shows resize and move cursors', () => {
        box({ resizeEdges: ['left', 'right'] });
        click(canvas, 150, 120);
        hover(canvas, 201, 120);
        expect(canvas.style.cursor).toBe('ew-resize');
        hover(canvas, 150, 120);
        expect(canvas.style.cursor).toBe('move');
    });

    it('view mode: no selection or drag, but double-click action still works', () => {
        const onAction = vi.fn();
        const r = box({ onAction });
        click(canvas, 150, 120);
        expect(selection.selected).toBe(r);
        scene.editable = false;
        expect(selection.selected).toBeNull();
        click(canvas, 150, 120);
        expect(selection.selected).toBeNull();
        drag(canvas, [150, 120], [180, 120]);
        expect(r.x).toBe(100);
        expect(scene.camera.x).toBeCloseTo(-30);
        doubleClick(canvas, 150 + 30, 120); // camera moved left by 30 world units
        expect(onAction).toHaveBeenCalledTimes(1);
    });

    it('selectInViewMode keeps selection without dragging', () => {
        selection.destroy();
        const s = new SelectionController(scene, { selectInViewMode: true });
        const r = box();
        scene.editable = false;
        click(canvas, 150, 120);
        expect(s.selected).toBe(r);
        drag(canvas, [150, 120], [180, 120]);
        expect(r.x).toBe(100);
    });

    it('clears when the selected shape is removed, and on Escape', () => {
        const r = box();
        click(canvas, 150, 120);
        scene.remove(r);
        expect(selection.selected).toBeNull();
        const r2 = box();
        click(canvas, 150, 120);
        expect(selection.selected).toBe(r2);
        key('keydown', 'Escape', 'Escape');
        expect(selection.selected).toBeNull();
    });
});

describe('VertexEditController', () => {
    let poly: PolygonShape;
    let vertex: VertexEditController;

    beforeEach(() => {
        vertex = new VertexEditController(scene, selection);
        poly = scene.add(
            new PolygonShape({
                draggable: true,
                points: [
                    { x: 100, y: 100 },
                    { x: 200, y: 100 },
                    { x: 200, y: 200 },
                    { x: 100, y: 200 },
                ],
            })
        );
    });

    it('drags a vertex of the selected polygon (and not the whole polygon)', () => {
        click(canvas, 150, 150);
        expect(vertex.target).toBe(poly);
        drag(canvas, [200, 200], [260, 230]);
        expect(poly.points[2]).toEqual({ x: 260, y: 230 });
        expect(poly.points[0]).toEqual({ x: 100, y: 100 });
        expect(changes[changes.length - 1]).toEqual({ shape: poly, kind: 'vertex-move', final: true, vertexIndex: 2 });
    });

    it('does not edit vertices of an unselected polygon', () => {
        drag(canvas, [200, 200], [260, 230]);
        expect(poly.points[2]).toEqual({ x: 200, y: 200 });
    });

    it('dragging the inside still moves the whole polygon', () => {
        click(canvas, 150, 150);
        drag(canvas, [150, 150], [160, 150]);
        expect(poly.points[0]).toEqual({ x: 110, y: 100 });
    });

    it('double-click on an edge inserts a vertex and suppresses the action', () => {
        const onAction = vi.fn();
        poly.onAction = onAction;
        click(canvas, 150, 150);
        doubleClick(canvas, 150, 101);
        expect(poly.points).toHaveLength(5);
        expect(poly.points[1]).toEqual({ x: 150, y: 100 });
        expect(changes[changes.length - 1]).toMatchObject({ kind: 'vertex-add', final: true, vertexIndex: 1 });
        expect(onAction).not.toHaveBeenCalled();
        doubleClick(canvas, 150, 150); // interior → action
        expect(onAction).toHaveBeenCalledTimes(1);
    });

    it('insertOn: click inserts on a single click', () => {
        vertex.destroy();
        vertex = new VertexEditController(scene, selection, { insertOn: 'click' });
        click(canvas, 150, 150);
        click(canvas, 199, 150);
        expect(poly.points).toHaveLength(5);
        expect(poly.points[2]).toEqual({ x: 200, y: 150 });
        expect(selection.selected).toBe(poly);
    });

    it('right-click removes a vertex, keeping at least 3', () => {
        click(canvas, 150, 150);
        const e = fire(canvas, 'contextmenu', 100, 100, { button: 2 });
        expect(e.defaultPrevented).toBe(true);
        expect(poly.points).toHaveLength(3);
        expect(changes[changes.length - 1]).toMatchObject({ kind: 'vertex-remove', vertexIndex: 0 });
        fire(canvas, 'contextmenu', 200, 100, { button: 2 });
        expect(poly.points).toHaveLength(3);
    });

    it('is inactive in view mode', () => {
        selection.destroy();
        const s = new SelectionController(scene, { selectInViewMode: true });
        vertex.destroy();
        vertex = new VertexEditController(scene, s);
        scene.editable = false;
        click(canvas, 150, 150);
        expect(s.selected).toBe(poly);
        expect(vertex.target).toBeNull();
        fire(canvas, 'contextmenu', 100, 100, { button: 2 });
        expect(poly.points).toHaveLength(4);
    });
});

describe('LineTool', () => {
    it('places a line in two clicks, anchoring to shapes', () => {
        const tool = new LineTool(scene, { arrow: 'end' });
        const a = box({ x: 0, y: 0, width: 50, height: 50 });
        const b = box({ x: 200, y: 0, width: 50, height: 50 });
        const created = vi.fn();
        scene.events.on('create', created);
        tool.activate();
        click(canvas, 25, 25);
        expect(tool.placing).toBe(true);
        click(canvas, 225, 25);
        expect(created).toHaveBeenCalledTimes(1);
        const line = created.mock.calls[0][0].shape as LineShape;
        expect(line).toBeInstanceOf(LineShape);
        expect(line.arrow).toBe('end');
        expect(line.getEndpoints()).toEqual([
            { x: 50, y: 25 },
            { x: 200, y: 25 },
        ]);
        expect(scene.has(line)).toBe(true);
        expect(tool.active).toBe(false);
        expect(selection.selected).toBeNull(); // clicks went to the tool
        void a;
        void b;
    });

    it('free points, continuous mode and Escape to cancel', () => {
        const tool = new LineTool(scene, { continuous: true, snap: false });
        tool.activate();
        click(canvas, 10, 10);
        click(canvas, 60, 10);
        click(canvas, 10, 50);
        expect(tool.active).toBe(true);
        expect(tool.placing).toBe(true);
        key('keydown', 'Escape', 'Escape');
        expect(tool.active).toBe(false);
        const lines = scene.getShapes().filter((s) => s instanceof LineShape);
        expect(lines).toHaveLength(1);
        expect((lines[0] as LineShape).getEndpoints()).toEqual([
            { x: 10, y: 10 },
            { x: 60, y: 10 },
        ]);
    });

    it('does nothing in view mode', () => {
        const tool = new LineTool(scene);
        scene.editable = false;
        tool.activate();
        expect(tool.active).toBe(false);
    });
});
