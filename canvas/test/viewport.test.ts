import { describe, expect, it, vi } from 'vitest';
import { Viewport } from '../src/scene/Viewport';

const viewportOf = (size = { width: 800, height: 600 }) => {
    const viewport = new Viewport();
    viewport.setSize(size);
    return viewport;
};

describe('screen ↔ world', () => {
    it('is the identity at the default transform', () => {
        const viewport = viewportOf();
        expect(viewport.screenToWorld({ x: 100, y: 50 })).toEqual({ x: 100, y: 50 });
        expect(viewport.worldToScreen({ x: 100, y: 50 })).toEqual({ x: 100, y: 50 });
    });

    it('round-trips through pan and zoom', () => {
        const viewport = viewportOf();
        viewport.set({ position: { x: -37.5, y: 12.25 }, pixelSize: { width: 0.5, height: 2 } });
        const world = viewport.screenToWorld({ x: 123, y: 456 });
        const screen = viewport.worldToScreen(world);
        expect(screen.x).toBeCloseTo(123, 9);
        expect(screen.y).toBeCloseTo(456, 9);
    });

    it('scales deltas without translating them', () => {
        const viewport = viewportOf();
        viewport.set({ position: { x: 1000, y: 1000 }, pixelSize: { width: 2, height: 4 } });
        expect(viewport.screenDeltaToWorld({ x: 10, y: 10 })).toEqual({ x: 20, y: 40 });
        expect(viewport.worldDeltaToScreen({ x: 20, y: 40 })).toEqual({ x: 10, y: 10 });
    });

    it('converts a screen length to world units on the x axis', () => {
        const viewport = viewportOf();
        viewport.set({ pixelSize: { width: 3, height: 7 } });
        expect(viewport.screenLengthToWorld(4)).toBe(12);
    });

    it('exposes scale as the reciprocal of pixel size', () => {
        const viewport = viewportOf();
        viewport.set({ pixelSize: { width: 4, height: 0.5 } });
        expect(viewport.scale).toEqual({ width: 0.25, height: 2 });
    });
});

describe('pan', () => {
    it('moves the content with the pointer', () => {
        const viewport = viewportOf();
        // Dragging right by 10px shows more of what was to the *left*, so the view origin
        // decreases.
        viewport.pan({ x: 10, y: 0 });
        expect(viewport.position).toEqual({ x: -10, y: 0 });
    });

    it('scales the pan by the zoom', () => {
        const viewport = viewportOf();
        viewport.set({ pixelSize: { width: 4, height: 4 } });
        viewport.pan({ x: 10, y: 5 });
        expect(viewport.position).toEqual({ x: -40, y: -20 });
    });

    it('pans by world units directly for the keyboard', () => {
        const viewport = viewportOf();
        viewport.panWorld({ x: 25, y: -25 });
        expect(viewport.position).toEqual({ x: 25, y: -25 });
    });
});

describe('zoom', () => {
    /** The defining property: the world point under the cursor does not move. */
    it('pins the world point under the cursor', () => {
        const viewport = viewportOf();
        const screen = { x: 200, y: 150 };
        const before = viewport.screenToWorld(screen);
        viewport.zoomAt(screen, 2);
        const after = viewport.screenToWorld(screen);
        expect(after.x).toBeCloseTo(before.x, 9);
        expect(after.y).toBeCloseTo(before.y, 9);
    });

    it('pins it through a zoom out as well', () => {
        const viewport = viewportOf();
        viewport.set({ position: { x: 300, y: -120 }, pixelSize: { width: 0.25, height: 0.25 } });
        const screen = { x: 640, y: 480 };
        const before = viewport.screenToWorld(screen);
        viewport.zoomAt(screen, 0.4);
        const after = viewport.screenToWorld(screen);
        expect(after.x).toBeCloseTo(before.x, 9);
        expect(after.y).toBeCloseTo(before.y, 9);
    });

    it('zooms in when the factor is greater than one', () => {
        const viewport = viewportOf();
        viewport.zoomAt({ x: 0, y: 0 }, 2);
        expect(viewport.pixelSize.width).toBeCloseTo(0.5, 9);
    });

    /** The timeline's case: time and rows zoom at different rates. */
    it('zooms each axis independently', () => {
        const viewport = viewportOf();
        viewport.zoomAt({ x: 0, y: 0 }, { width: 4, height: 1 });
        expect(viewport.pixelSize.width).toBeCloseTo(0.25, 9);
        expect(viewport.pixelSize.height).toBeCloseTo(1, 9);
    });

    it('zooms about the canvas centre', () => {
        const viewport = viewportOf();
        const before = viewport.center;
        viewport.zoomAtCenter(2);
        expect(viewport.center.x).toBeCloseTo(before.x, 9);
        expect(viewport.center.y).toBeCloseTo(before.y, 9);
    });

    it('clamps to the configured zoom range', () => {
        const viewport = new Viewport({ minPixelSize: 0.5, maxPixelSize: 4 });
        viewport.setSize({ width: 100, height: 100 });

        viewport.zoomAt({ x: 0, y: 0 }, 1000);
        expect(viewport.pixelSize.width).toBe(0.5);

        viewport.zoomAt({ x: 0, y: 0 }, 0.00001);
        expect(viewport.pixelSize.width).toBe(4);
    });
});

describe('fit', () => {
    it('frames a box with padding to spare', () => {
        const viewport = viewportOf({ width: 800, height: 600 });
        viewport.fit({ min: { x: 0, y: 0 }, max: { x: 1000, y: 500 } }, 50);

        const visible = viewport.visibleBounds;
        expect(visible.min.x).toBeLessThanOrEqual(0);
        expect(visible.max.x).toBeGreaterThanOrEqual(1000);
        expect(visible.min.y).toBeLessThanOrEqual(0);
        expect(visible.max.y).toBeGreaterThanOrEqual(500);
    });

    /** Anisotropic fit would stretch the map to the window's aspect ratio. */
    it('keeps the aspect ratio', () => {
        const viewport = viewportOf({ width: 800, height: 600 });
        viewport.fit({ min: { x: 0, y: 0 }, max: { x: 1000, y: 100 } });
        expect(viewport.pixelSize.width).toBeCloseTo(viewport.pixelSize.height, 9);
    });

    it('centres the box', () => {
        const viewport = viewportOf();
        viewport.fit({ min: { x: 100, y: 200 }, max: { x: 300, y: 400 } });
        expect(viewport.center.x).toBeCloseTo(200, 6);
        expect(viewport.center.y).toBeCloseTo(300, 6);
    });

    it('only centres on a degenerate box rather than zooming to the clamp', () => {
        const viewport = viewportOf();
        const before = viewport.pixelSize.width;
        viewport.fit({ min: { x: 50, y: 50 }, max: { x: 50, y: 50 } });
        expect(viewport.pixelSize.width).toBe(before);
        expect(viewport.center.x).toBeCloseTo(50, 6);
    });

    it('does nothing for an empty box', () => {
        const viewport = viewportOf();
        const before = { ...viewport.position };
        viewport.fit({ min: { x: Infinity, y: Infinity }, max: { x: -Infinity, y: -Infinity } });
        expect(viewport.position).toEqual(before);
    });

    it('does nothing before the canvas has a size', () => {
        const viewport = new Viewport();
        viewport.fit({ min: { x: 0, y: 0 }, max: { x: 100, y: 100 } });
        expect(viewport.position).toEqual({ x: 0, y: 0 });
    });
});

describe('notifications', () => {
    it('fires once per logical change, not once per field', () => {
        const viewport = viewportOf();
        const listener = vi.fn();
        viewport.onChange.subscribe(listener);

        viewport.zoomAt({ x: 100, y: 100 }, 2);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('stays quiet when nothing actually moved', () => {
        const viewport = viewportOf();
        const listener = vi.fn();
        viewport.onChange.subscribe(listener);

        viewport.set({ position: { ...viewport.position } });
        viewport.pan({ x: 0, y: 0 });
        expect(listener).not.toHaveBeenCalled();
    });

    it('reports a resize', () => {
        const viewport = viewportOf();
        const listener = vi.fn();
        viewport.onResize.subscribe(listener);

        viewport.setSize({ width: 1024, height: 768 });
        expect(listener).toHaveBeenCalledWith({ width: 1024, height: 768 });

        viewport.setSize({ width: 1024, height: 768 });
        expect(listener).toHaveBeenCalledTimes(1);
    });
});

describe('centerOn and reset', () => {
    it('puts a world point at the centre', () => {
        const viewport = viewportOf();
        viewport.set({ pixelSize: { width: 2, height: 2 } });
        viewport.centerOn({ x: 500, y: 500 });
        expect(viewport.center.x).toBeCloseTo(500, 9);
        expect(viewport.center.y).toBeCloseTo(500, 9);
    });

    it('resets to the origin at 1:1', () => {
        const viewport = viewportOf();
        viewport.set({ position: { x: 99, y: 99 }, pixelSize: { width: 7, height: 7 } });
        viewport.reset();
        expect(viewport.position).toEqual({ x: 0, y: 0 });
        expect(viewport.pixelSize).toEqual({ width: 1, height: 1 });
    });
});
