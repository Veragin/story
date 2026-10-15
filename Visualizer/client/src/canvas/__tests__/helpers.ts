import { vi } from 'vitest';

let queue = new Map<number, FrameRequestCallback>();
let nextHandle = 1;
let now = 0;

export const installFrames = (): void => {
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
};

export const uninstallFrames = (): void => {
    vi.unstubAllGlobals();
};

export const pendingFrames = (): number => {
    return queue.size;
};

export const flushFrames = (count = 1, dt = 16): void => {
    for (let i = 0; i < count && queue.size > 0; i++) {
        const cbs = [...queue.values()];
        queue.clear();
        now += dt;
        for (const cb of cbs) cb(now);
    }
};

export const createCanvas = (width = 800, height = 600): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'clientWidth', { configurable: true, value: width });
    Object.defineProperty(canvas, 'clientHeight', { configurable: true, value: height });
    document.body.appendChild(canvas);
    return canvas;
};

type TMouseOpts = { button?: number; buttons?: number; shiftKey?: boolean; ctrlKey?: boolean };

// jsdom has no PointerEvent; a MouseEvent named like one reaches the scene's listeners
export const fire = (target: EventTarget, type: string, x: number, y: number, opts: TMouseOpts = {}): MouseEvent => {
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
};

export const click = (canvas: HTMLCanvasElement, x: number, y: number): void => {
    fire(canvas, 'pointerdown', x, y);
    fire(canvas, 'pointerup', x, y);
};

export const doubleClick = (canvas: HTMLCanvasElement, x: number, y: number): void => {
    click(canvas, x, y);
    click(canvas, x, y);
    fire(canvas, 'dblclick', x, y);
};

export const drag = (canvas: HTMLCanvasElement, from: [number, number], to: [number, number], steps = 4): void => {
    fire(canvas, 'pointerdown', from[0], from[1]);
    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        fire(canvas, 'pointermove', from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t);
    }
    fire(canvas, 'pointerup', to[0], to[1]);
};

export const hover = (canvas: HTMLCanvasElement, x: number, y: number): void => {
    fire(canvas, 'pointermove', x, y, { buttons: 0 });
};

export const key = (
    type: 'keydown' | 'keyup',
    code: string,
    keyName = code,
    target: EventTarget = window
): KeyboardEvent => {
    const e = new KeyboardEvent(type, { code, key: keyName, bubbles: true, cancelable: true });
    target.dispatchEvent(e);
    return e;
};
