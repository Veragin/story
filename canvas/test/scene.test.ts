import type { TBBox, TPoint } from '@story/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeRenderer } from '../src/renderer/FakeRenderer';
import type { TDrawSpec } from '../src/renderer/types';
import { Scene } from '../src/scene/Scene';
import { SceneObject, type TSceneObjectOptions } from '../src/scene/SceneObject';

/**
 * A minimal concrete `SceneObject`. The real ones arrive in Phase 2; what is under test here is
 * the base class and the scene around it, so a square with a position is exactly enough.
 */
class TestBox extends SceneObject {
    readonly type = 'test-box';
    private _position: TPoint;
    private readonly extent: number;

    constructor(options: TSceneObjectOptions & { position?: TPoint; extent?: number }) {
        super(options);
        this._position = options.position ?? { x: 0, y: 0 };
        this.extent = options.extent ?? 10;
    }

    get position(): TPoint {
        return this._position;
    }

    set position(value: TPoint) {
        this._position = value;
        this.notify('position');
    }

    get bounds(): TBBox {
        return {
            min: { ...this._position },
            max: { x: this._position.x + this.extent, y: this._position.y + this.extent },
        };
    }

    translate(delta: TPoint): void {
        this.position = { x: this._position.x + delta.x, y: this._position.y + delta.y };
    }

    toSpec(): TDrawSpec {
        return {
            kind: 'rect',
            position: this._position,
            size: { width: this.extent, height: this.extent },
            fill: '#ff0000',
        };
    }
}

let renderer: FakeRenderer;
let scene: Scene;
let container: HTMLElement;

const mount = (width = 800, height = 600) => {
    container = document.createElement('div');
    // jsdom reports 0 for every layout property, so the sizes the scene reads are stubbed.
    Object.defineProperty(container, 'clientWidth', { value: width, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: height, configurable: true });
    document.body.appendChild(container);
    scene.mount(container);
};

beforeEach(() => {
    document.body.innerHTML = '';
    renderer = new FakeRenderer();
    scene = new Scene({ renderer });
});

describe('mounting', () => {
    it('sizes the viewport from the container', () => {
        mount(640, 480);
        expect(scene.viewport.size).toEqual({ width: 640, height: 480 });
        expect(renderer.size).toEqual({ width: 640, height: 480 });
    });

    it('pushes the initial transform to the renderer', () => {
        mount();
        expect(renderer.transform.scale).toEqual({ width: 1, height: 1 });
    });

    it('tears the renderer down on destroy', () => {
        mount();
        scene.destroy();
        expect(renderer.destroyed).toBe(true);
    });

    it('refuses to mount after destroy', () => {
        mount();
        scene.destroy();
        expect(() => scene.mount(container)).toThrow(/destroyed/i);
    });
});

describe('drawing', () => {
    it('draws what an object says it looks like', async () => {
        mount();
        scene.add(new TestBox({ id: 'a' }));
        await scene.flush();

        const spec = renderer.find('a');
        expect(spec).toMatchObject({ kind: 'rect', fill: '#ff0000' });
    });

    it('coalesces many changes into one frame', async () => {
        mount();
        const box = scene.add(new TestBox({ id: 'a' }));
        await scene.flush();

        const drawsBefore = renderer.calls.draw;
        for (let i = 0; i < 50; i++) box.position = { x: i, y: i };
        await scene.flush();

        expect(renderer.calls.draw).toBe(drawsBefore + 1);
    });

    it('removes an object’s drawing when it leaves the scene', async () => {
        mount();
        const box = scene.add(new TestBox({ id: 'a' }));
        await scene.flush();
        expect(renderer.find('a')).toBeDefined();

        scene.remove(box);
        await scene.flush();
        expect(renderer.find('a')).toBeUndefined();
    });

    it('stops drawing an object that becomes invisible', async () => {
        mount();
        const box = scene.add(new TestBox({ id: 'a' }));
        await scene.flush();

        box.visible = false;
        await scene.flush();
        expect(renderer.find('a')).toBeUndefined();

        box.visible = true;
        await scene.flush();
        expect(renderer.find('a')).toBeDefined();
    });

    it('stops listening to an object it no longer holds', async () => {
        mount();
        const box = scene.add(new TestBox({ id: 'a' }));
        await scene.flush();

        const changes = vi.fn();
        scene.onObjectChanged.subscribe(changes);

        scene.remove(box);
        box.position = { x: 500, y: 500 };

        expect(changes).not.toHaveBeenCalled();
        await scene.flush();
        expect(renderer.find('a')).toBeUndefined();
    });

    it('draws onto the layer the object names', async () => {
        mount();
        scene.add(new TestBox({ id: 'bg', layer: 'background' }));
        scene.add(new TestBox({ id: 'handle', layer: 'overlay' }));
        await scene.flush();

        expect(renderer.idsOn('background')).toEqual(['bg']);
        expect(renderer.idsOn('overlay')).toEqual(['handle']);
        expect(renderer.idsOn('content')).toEqual([]);
    });
});

describe('paint order', () => {
    it('sorts by z, then by insertion', async () => {
        mount();
        scene.add(new TestBox({ id: 'first', z: 0 }));
        scene.add(new TestBox({ id: 'second', z: 0 }));
        scene.add(new TestBox({ id: 'top', z: 5 }));
        await scene.flush();

        expect(renderer.idsOn('content')).toEqual(['first', 'second', 'top']);
    });

    it('re-sorts when z changes', async () => {
        mount();
        const first = scene.add(new TestBox({ id: 'first' }));
        scene.add(new TestBox({ id: 'second' }));
        await scene.flush();

        first.z = 10;
        await scene.flush();
        expect(renderer.idsOn('content')).toEqual(['second', 'first']);
    });

    it('rejects a duplicate id rather than silently losing one', () => {
        mount();
        scene.add(new TestBox({ id: 'a' }));
        expect(() => scene.add(new TestBox({ id: 'a' }))).toThrow(/duplicate/i);
    });
});

describe('hit testing', () => {
    it('finds the object under the point', () => {
        mount();
        scene.add(new TestBox({ id: 'a', position: { x: 0, y: 0 } }));
        expect(scene.hitTest({ x: 5, y: 5 })?.id).toBe('a');
        expect(scene.hitTest({ x: 500, y: 500 })).toBeUndefined();
    });

    /** Topmost first: what the author sees on top is what a click finds. */
    it('returns the topmost of overlapping objects', () => {
        mount();
        scene.add(new TestBox({ id: 'under', z: 0 }));
        scene.add(new TestBox({ id: 'over', z: 1 }));
        expect(scene.hitTest({ x: 5, y: 5 })?.id).toBe('over');
    });

    it('lists every hit, topmost first', () => {
        mount();
        scene.add(new TestBox({ id: 'under', z: 0 }));
        scene.add(new TestBox({ id: 'over', z: 1 }));
        expect(scene.hitTestAll({ x: 5, y: 5 }).map((o) => o.id)).toEqual(['over', 'under']);
    });

    it('honours a filter', () => {
        mount();
        scene.add(new TestBox({ id: 'under', z: 0 }));
        scene.add(new TestBox({ id: 'over', z: 1 }));
        expect(scene.hitTest({ x: 5, y: 5 }, (o) => o.id === 'under')?.id).toBe('under');
    });

    it('ignores invisible objects', () => {
        mount();
        const box = scene.add(new TestBox({ id: 'a' }));
        box.visible = false;
        expect(scene.hitTest({ x: 5, y: 5 })).toBeUndefined();
    });

    /**
     * The tolerance is a screen-pixel constant, so the same click slop covers more world units
     * as the author zooms out. Without that, a thin line becomes unclickable when zoomed out.
     */
    it('grows the world tolerance as the view zooms out', () => {
        mount();
        expect(scene.worldTolerance).toBeCloseTo(4, 9);
        scene.viewport.set({ pixelSize: { width: 10, height: 10 } });
        expect(scene.worldTolerance).toBeCloseTo(40, 9);
    });

    it('picks up a near-miss through the tolerance', () => {
        mount();
        scene.add(new TestBox({ id: 'a', position: { x: 0, y: 0 }, extent: 10 }));
        // 2px outside the box, inside the 4px slop.
        expect(scene.hitTest({ x: 12, y: 5 })?.id).toBe('a');
        expect(scene.hitTest({ x: 20, y: 5 })).toBeUndefined();
    });
});

describe('marquee', () => {
    it('takes only what lies wholly inside by default', () => {
        mount();
        scene.add(new TestBox({ id: 'inside', position: { x: 10, y: 10 }, extent: 10 }));
        scene.add(new TestBox({ id: 'straddling', position: { x: 95, y: 10 }, extent: 10 }));

        const box = { min: { x: 0, y: 0 }, max: { x: 100, y: 100 } };
        expect(scene.hitTestBox(box).map((o) => o.id)).toEqual(['inside']);
        expect(scene.hitTestBox(box, 'intersect').map((o) => o.id)).toEqual(['inside', 'straddling']);
    });

    it('skips unselectable objects', () => {
        mount();
        scene.add(new TestBox({ id: 'a', position: { x: 10, y: 10 }, selectable: false }));
        expect(scene.hitTestBox({ min: { x: 0, y: 0 }, max: { x: 100, y: 100 } })).toEqual([]);
    });
});

describe('content bounds and fit', () => {
    it('unions the visible content', () => {
        mount();
        scene.add(new TestBox({ id: 'a', position: { x: 0, y: 0 }, extent: 10 }));
        scene.add(new TestBox({ id: 'b', position: { x: 90, y: 40 }, extent: 10 }));
        expect(scene.contentBounds).toEqual({ min: { x: 0, y: 0 }, max: { x: 100, y: 50 } });
    });

    /** Handles and guides are not content; fitting to them would frame the wrong thing. */
    it('excludes overlay and interaction layers', () => {
        mount();
        scene.add(new TestBox({ id: 'a', position: { x: 0, y: 0 }, extent: 10 }));
        scene.add(new TestBox({ id: 'handle', position: { x: 9000, y: 9000 }, layer: 'overlay' }));
        expect(scene.contentBounds.max.x).toBe(10);
    });

    it('does nothing when there is nothing to fit', () => {
        mount();
        const before = { ...scene.viewport.position };
        scene.fitToContent();
        expect(scene.viewport.position).toEqual(before);
    });

    it('frames the content when there is some', () => {
        mount();
        scene.add(new TestBox({ id: 'a', position: { x: 1000, y: 1000 }, extent: 100 }));
        scene.fitToContent();
        expect(scene.viewport.center.x).toBeCloseTo(1050, 6);
    });
});

describe('input routing', () => {
    it('re-emits pointer events', () => {
        mount();
        const listener = vi.fn();
        scene.onPointer.subscribe(listener);

        renderer.emitPointer({ type: 'down', world: { x: 5, y: 5 } });
        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener.mock.calls[0][0]).toMatchObject({ type: 'down', world: { x: 5, y: 5 } });
    });

    it('re-emits key events', () => {
        mount();
        const listener = vi.fn();
        scene.onKey.subscribe(listener);

        renderer.emitKey({ key: 'Escape' });
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('stops routing input after destroy', () => {
        mount();
        const listener = vi.fn();
        scene.onPointer.subscribe(listener);
        scene.destroy();

        renderer.emitPointer({ type: 'down', world: { x: 0, y: 0 } });
        expect(listener).not.toHaveBeenCalled();
    });

    it('re-emits object changes for stores to observe', () => {
        mount();
        const box = scene.add(new TestBox({ id: 'a' }));
        const listener = vi.fn();
        scene.onObjectChanged.subscribe(listener);

        box.position = { x: 1, y: 1 };
        expect(listener).toHaveBeenCalledWith({ object: box, property: 'position' });
    });
});

describe('viewport integration', () => {
    it('pushes a new transform to the renderer and redraws', async () => {
        mount();
        scene.viewport.zoomAt({ x: 0, y: 0 }, 2);
        await scene.flush();
        expect(renderer.transform.scale.width).toBeCloseTo(2, 9);
    });

    it('forwards layer caching', () => {
        mount();
        scene.setLayerCached('background', true);
        expect(renderer.cachedLayers.has('background')).toBe(true);
        scene.setLayerCached('background', false);
        expect(renderer.cachedLayers.has('background')).toBe(false);
    });
});

describe('SceneObject basics', () => {
    it('carries arbitrary meta without knowing what it means', () => {
        const box = new TestBox({ id: 'a', meta: { locationId: 'village' } });
        expect(box.getMeta<string>('locationId')).toBe('village');
        box.setMeta('color', '#fff');
        expect(box.meta).toEqual({ locationId: 'village', color: '#fff' });
    });

    it('does not notify when a property is set to its current value', () => {
        const box = new TestBox({ id: 'a' });
        const listener = vi.fn();
        box.onChange.subscribe(listener);
        box.z = 0;
        box.visible = true;
        expect(listener).not.toHaveBeenCalled();
    });

    it('round-trips its base state through JSON', () => {
        const box = new TestBox({ id: 'a', z: 3, layer: 'overlay', meta: { k: 1 } });
        expect(box.toJSON()).toMatchObject({ type: 'test-box', id: 'a', z: 3, layer: 'overlay', meta: { k: 1 } });
    });

    it('marks a gesture transient and restores the flag afterwards', () => {
        const box = new TestBox({ id: 'a' });
        expect(box.transient).toBe(false);
        box.duringGesture(() => {
            expect(box.transient).toBe(true);
        });
        expect(box.transient).toBe(false);
    });

    it('restores the flag even when the gesture throws', () => {
        const box = new TestBox({ id: 'a' });
        expect(() =>
            box.duringGesture(() => {
                throw new Error('boom');
            })
        ).toThrow('boom');
        expect(box.transient).toBe(false);
    });

    it('translates by a world delta', () => {
        const box = new TestBox({ id: 'a', position: { x: 5, y: 5 } });
        box.translate({ x: 10, y: -2 });
        expect(box.bounds.min).toEqual({ x: 15, y: 3 });
    });
});
