import { describe, expect, it, vi } from 'vitest';
import { Camera } from './Camera';

describe('Camera', () => {
    it('converts between screen and world', () => {
        const c = new Camera({ x: 100, y: 50, zoom: 2 });
        expect(c.worldToScreen({ x: 110, y: 60 })).toEqual({ x: 20, y: 20 });
        expect(c.screenToWorld({ x: 20, y: 20 })).toEqual({ x: 110, y: 60 });
    });

    it('zoomAt keeps the world point under the cursor fixed', () => {
        const c = new Camera({ x: 10, y: 20, zoom: 1 });
        const screen = { x: 300, y: 200 };
        const before = c.screenToWorld(screen);
        c.zoomAt(screen, 2.5);
        const after = c.screenToWorld(screen);
        expect(c.zoom).toBe(2.5);
        expect(after.x).toBeCloseTo(before.x);
        expect(after.y).toBeCloseTo(before.y);
    });

    it('clamps zoom and applies constrain', () => {
        const c = new Camera({ minZoom: 0.5, maxZoom: 4, constrain: (s) => ({ ...s, y: 0 }) });
        c.setZoom(100);
        expect(c.zoom).toBe(4);
        c.panByWorld(10, 10);
        expect(c.y).toBe(0);
        expect(c.x).toBe(10);
    });

    it('notifies subscribers only on real changes and unsubscribes', () => {
        const c = new Camera();
        const fn = vi.fn();
        const off = c.subscribe(fn);
        c.set({ x: 0 });
        expect(fn).not.toHaveBeenCalled();
        c.panByScreen(10, 0);
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn.mock.calls[0][0]).toEqual({ x: -10, y: 0, zoom: 1 });
        off();
        c.panByScreen(10, 0);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('fitRect and centerOn', () => {
        const c = new Camera();
        c.fitRect({ x: 0, y: 0, width: 100, height: 50 }, { width: 220, height: 220 }, 10);
        expect(c.zoom).toBeCloseTo(2);
        const center = c.screenToWorld({ x: 110, y: 110 });
        expect(center.x).toBeCloseTo(50);
        expect(center.y).toBeCloseTo(25);
        c.centerOn({ x: 0, y: 0 }, { width: 200, height: 100 });
        expect(c.worldToScreen({ x: 0, y: 0 })).toEqual({ x: 100, y: 50 });
    });
});
