/**
 * Vitest setup for the `visualizer-client` jsdom project.
 *
 * jsdom has no 2D canvas: `getContext('2d')` returns null (and logs "not implemented"). The
 * scene works without a context, but stubbing one lets tests exercise the draw path too. The
 * stub records every method call in `ctx.__calls` and accepts any property write.
 */
type TMockContext = CanvasRenderingContext2D & { __calls: { name: string; args: unknown[] }[] };

function createMockContext(canvas: HTMLCanvasElement): TMockContext {
    const calls: { name: string; args: unknown[] }[] = [];
    const props: Record<string | symbol, unknown> = { canvas, __calls: calls, lineWidth: 1, font: '10px sans-serif' };
    return new Proxy(props, {
        get(target, key) {
            if (key in target) return target[key];
            if (key === 'measureText') {
                return (text: string) => ({ width: String(text).length * 7 });
            }
            if (key === 'getLineDash') return () => [];
            if (typeof key === 'symbol' || key === 'then') return undefined;
            return (...args: unknown[]) => {
                calls.push({ name: key, args });
            };
        },
        set(target, key, value) {
            target[key] = value;
            return true;
        },
    }) as unknown as TMockContext;
}

const contexts = new WeakMap<HTMLCanvasElement, TMockContext>();

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    writable: true,
    value: function getContext(this: HTMLCanvasElement, type: string) {
        if (type !== '2d') return null;
        let ctx = contexts.get(this);
        if (!ctx) {
            ctx = createMockContext(this);
            contexts.set(this, ctx);
        }
        return ctx;
    },
});

export {};
