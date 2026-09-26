import { vi } from 'vitest';

/**
 * Manual animation frames: `requestAnimationFrame` queues, `flushFrames()` runs the queue.
 * Call `installFrames()` in `beforeEach` and `uninstallFrames()` in `afterEach`.
 */
let queue = new Map<number, FrameRequestCallback>();
let nextHandle = 1;
let now = 0;

export function installFrames(): void {
    queue = new Map();
    now = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        const h = nextHandle++;
        queue.set(h, cb);
        return h;
    });
    vi.stubGlobal('cancelAnimationFrame', (h: number) => {
        queue.delete(h);
    });
}

export function uninstallFrames(): void {
    vi.unstubAllGlobals();
}

export function pendingFrames(): number {
    return queue.size;
}

/** Runs queued frames, advancing the clock by `dt` ms per frame, `count` times (or until idle). */
export function flushFrames(count = 1, dt = 16): void {
    for (let i = 0; i < count && queue.size > 0; i++) {
        const cbs = [...queue.values()];
        queue.clear();
        now += dt;
        for (const cb of cbs) cb(now);
    }
}

export function createCanvas(width = 800, height = 600): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: width });
    Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: height });
    document.body.appendChild(canvas);
    return canvas;
}

type TMouseOpts = { button?: number; buttons?: number; shiftKey?: boolean; ctrlKey?: boolean };

/** jsdom has no PointerEvent; a MouseEvent with a pointer type name is what the scene listens to. */
export function fire(target: EventTarget, type: string, x: number, y: number, opts: TMouseOpts = {}): MouseEvent {
    const e = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        button: opts.button ?? 0,
        buttons: opts.buttons ?? (type === 'pointerup' ? 0 : 1),
        shiftKey: opts.shiftKey,
        ctrlKey: opts.ctrlKey,
    });
    target.dispatchEvent(e);
    return e;
}

/** A full left click: down + up at the same spot. */
export function click(canvas: HTMLCanvasElement, x: number, y: number): void {
    fire(canvas, 'pointerdown', x, y);
    fire(canvas, 'pointerup', x, y);
}

export function doubleClick(canvas: HTMLCanvasElement, x: number, y: number): void {
    click(canvas, x, y);
    click(canvas, x, y);
    fire(canvas, 'dblclick', x, y);
}

/** Press at `from`, move in `steps` to `to`, release. */
export function drag(canvas: HTMLCanvasElement, from: [number, number], to: [number, number], steps = 4): void {
    fire(canvas, 'pointerdown', from[0], from[1]);
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        fire(canvas, 'pointermove', from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t);
    }
    fire(canvas, 'pointerup', to[0], to[1]);
}

export function hover(canvas: HTMLCanvasElement, x: number, y: number): void {
    fire(canvas, 'pointermove', x, y, { buttons: 0 });
}

export function key(
    type: 'keydown' | 'keyup',
    code: string,
    keyName = code,
    target: EventTarget = window
): KeyboardEvent {
    const e = new KeyboardEvent(type, { code, key: keyName, bubbles: true, cancelable: true });
    target.dispatchEvent(e);
    return e;
}
