import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Camera } from './Camera';
import { Scene } from './Scene';
import { LineShape } from './shapes/LineShape';
import { PolygonShape } from './shapes/PolygonShape';
import { RectShape } from './shapes/RectShape';
import { TextShape } from './shapes/TextShape';
import {
    createCanvas,
    doubleClick,
    drag,
    fire,
    flushFrames,
    hover,
    installFrames,
    key,
    pendingFrames,
    uninstallFrames,
} from './__tests__/helpers';

let scene: Scene;
let canvas: HTMLCanvasElement;

beforeEach(() => {
    installFrames();
    canvas = createCanvas();
    scene = new Scene(canvas);
});

afterEach(() => {
    scene.destroy();
    canvas.remove();
    uninstallFrames();
});

type TCall = { name: string; args: unknown[] };
const calls = () => (canvas.getContext('2d') as unknown as { __calls: TCall[] }).__calls;

describe('Scene', () => {
    it('sizes the backing store from the CSS size and pixel ratio', () => {
        const s = new Scene(createCanvas(100, 50), { pixelRatio: 2 });
        expect(s.canvas.width).toBe(200);
        expect(s.canvas.height).toBe(100);
        expect(s.size).toEqual({ width: 100, height: 50 });
        s.destroy();
    });

    it('hit-tests topmost first by layer, then zIndex, then insertion order', () => {
        const a = scene.add(new RectShape({ id: 'a', x: 0, y: 0, width: 100, height: 100 }));
        const b = scene.add(new RectShape({ id: 'b', x: 0, y: 0, width: 100, height: 100 }));
        expect(scene.hitTest({ x: 50, y: 50 })).toBe(b);
        a.zIndex = 5;
        expect(scene.hitTest({ x: 50, y: 50 })).toBe(a);
        scene.layer('top', 10);
        const c = scene.add(new RectShape({ id: 'c', x: 0, y: 0, width: 10, height: 10 }), 'top');
        expect(scene.hitTest({ x: 5, y: 5 })).toBe(c);
        scene.layer('top').interactive = false;
        expect(scene.hitTest({ x: 5, y: 5 })).toBe(a);
        a.update({ visible: false });
        expect(scene.hitTest({ x: 5, y: 5 })).toBe(b);
        expect(scene.getShape('c')).toBe(c);
        scene.remove(b);
        expect(b.host).toBeNull();
        expect(scene.hitTest({ x: 50, y: 50 })).toBeNull();
    });

    it('hit-tests every shape kind', () => {
        const poly = scene.add(
            new PolygonShape({
                points: [
                    { x: 200, y: 0 },
                    { x: 300, y: 0 },
                    { x: 250, y: 100 },
                ],
            })
        );
        const text = scene.add(new TextShape({ x: 400, y: 0, text: 'hello', fontSize: 10 }));
        const line = scene.add(new LineShape({ from: { x: 0, y: 300 }, to: { x: 100, y: 300 } }));
        expect(scene.hitTest({ x: 250, y: 30 })).toBe(poly);
        expect(scene.hitTest({ x: 410, y: 5 })).toBe(text);
        expect(scene.hitTest({ x: 50, y: 302 })).toBe(line);
        expect(scene.hitTest({ x: 50, y: 320 })).toBeNull();
    });

    it('anchors lines to shape borders and follows them', () => {
        const a = scene.add(new RectShape({ x: 0, y: 0, width: 20, height: 20 }));
        const b = scene.add(new RectShape({ x: 100, y: 0, width: 20, height: 20 }));
        const line = scene.add(new LineShape({ from: { shape: a }, to: { shape: b, anchor: 'center' }, arrow: 'end' }));
        expect(line.getEndpoints()).toEqual([
            { x: 20, y: 10 },
            { x: 110, y: 10 },
        ]);
        a.translate(0, 100);
        const [start] = line.getEndpoints();
        // a is now at (0..20, 100..120); the ray to b's center leaves through its top-right corner
        expect(start.x).toBeCloseTo(20);
        expect(start.y).toBeCloseTo(100);
        expect(line.canTranslate()).toBe(false);
    });

    it('only redraws when invalidated, once per frame', () => {
        flushFrames();
        calls().length = 0;
        flushFrames();
        expect(calls().length).toBe(0);
        const r = scene.add(new RectShape({ x: 0, y: 0, width: 10, height: 10, fill: 'red' }));
        r.translate(1, 1);
        r.translate(1, 1);
        expect(pendingFrames()).toBe(1);
        flushFrames();
        expect(calls().filter((c) => c.name === 'fill').length).toBe(1);
        expect(pendingFrames()).toBe(0);
    });

    it('drag on empty space pans the camera', () => {
        drag(canvas, [100, 100], [150, 120]);
        expect(scene.camera.x).toBeCloseTo(-50);
        expect(scene.camera.y).toBeCloseTo(-20);
    });

    it('wheel zooms at the cursor', () => {
        const before = scene.screenToWorld({ x: 200, y: 100 });
        const e = new WheelEvent('wheel', { deltaY: -100, clientX: 200, clientY: 100, cancelable: true });
        canvas.dispatchEvent(e);
        expect(e.defaultPrevented).toBe(true);
        expect(scene.camera.zoom).toBeGreaterThan(1);
        const after = scene.screenToWorld({ x: 200, y: 100 });
        expect(after.x).toBeCloseTo(before.x);
        expect(after.y).toBeCloseTo(before.y);
    });

    it('pans with WASD / arrows while held, but not while typing in an input', () => {
        key('keydown', 'KeyD', 'd');
        flushFrames(10);
        key('keyup', 'KeyD', 'd');
        flushFrames(5);
        const x = scene.camera.x;
        expect(x).toBeGreaterThan(50);
        expect(pendingFrames()).toBe(0);

        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();
        key('keydown', 'ArrowDown', 'ArrowDown', input);
        flushFrames(10);
        expect(scene.camera.y).toBe(0);
        input.remove();
    });

    it('double-click calls onAction and emits action', () => {
        const onAction = vi.fn();
        const r = scene.add(new RectShape({ x: 0, y: 0, width: 50, height: 50, onAction, data: { id: 7 } }));
        const action = vi.fn();
        scene.events.on('action', action);
        doubleClick(canvas, 10, 10);
        expect(onAction).toHaveBeenCalledWith(r);
        expect(action.mock.calls[0][0].shape).toBe(r);
        doubleClick(canvas, 300, 300);
        expect(action).toHaveBeenCalledTimes(1);
    });

    it('emits hover on enter/leave and uses the shape cursor', () => {
        const r = scene.add(new RectShape({ x: 0, y: 0, width: 50, height: 50, cursor: 'help' }));
        const onHover = vi.fn();
        scene.events.on('hover', onHover);
        hover(canvas, 10, 10);
        hover(canvas, 12, 12);
        expect(onHover).toHaveBeenCalledTimes(1);
        expect(onHover.mock.calls[0][0]).toMatchObject({ shape: r, previous: null, client: { x: 10, y: 10 } });
        expect(r.hovered).toBe(true);
        expect(canvas.style.cursor).toBe('help');
        hover(canvas, 200, 200);
        expect(onHover).toHaveBeenCalledTimes(2);
        expect(onHover.mock.calls[1][0]).toMatchObject({ shape: null, previous: r });
        expect(canvas.style.cursor).toBe('default');
    });

    it('blocks the context menu on the canvas', () => {
        const e = fire(canvas, 'contextmenu', 10, 10, { button: 2 });
        expect(e.defaultPrevented).toBe(true);
    });

    it('two scenes share one camera', () => {
        const camera = new Camera();
        const c1 = createCanvas();
        const c2 = createCanvas();
        const s1 = new Scene(c1, { camera, keyboardPan: false });
        const s2 = new Scene(c2, { camera, keyboardPan: false });
        const follower = vi.fn();
        const off = camera.subscribe(follower);
        flushFrames();
        drag(c1, [10, 10], [30, 10]);
        expect(s2.camera.x).toBeCloseTo(-20);
        expect(follower).toHaveBeenCalled();
        expect(pendingFrames()).toBeGreaterThan(0);
        off();
        s1.destroy();
        s2.destroy();
    });

    it('destroy removes listeners, frames and camera subscriptions', () => {
        const camera = new Camera();
        const s = new Scene(createCanvas(), { camera });
        const onAction = vi.fn();
        const r = s.add(new RectShape({ x: 0, y: 0, width: 50, height: 50, onAction }));
        s.destroy();
        expect(pendingFrames()).toBe(1); // the frame from the outer `scene`, not from `s`
        doubleClick(s.canvas, 10, 10);
        expect(onAction).not.toHaveBeenCalled();
        expect(r.host).toBeNull();
        camera.panByScreen(10, 10);
        key('keydown', 'KeyW', 'w');
        expect(s.isDestroyed).toBe(true);
        expect(camera.y).toBe(-10);
    });

    it('removes window listeners after a drag ends', () => {
        const spy = vi.spyOn(window, 'removeEventListener');
        drag(canvas, [0, 0], [10, 10]);
        const removed = spy.mock.calls.map((c) => c[0]);
        expect(removed).toEqual(expect.arrayContaining(['pointermove', 'pointerup', 'pointercancel']));
        spy.mockRestore();
    });
});
