import { useEffect, useRef, type CSSProperties } from 'react';
import { KonvaRenderer } from '../renderer/KonvaRenderer';
import { Scene, type TSceneOptions } from '../scene/Scene';

/**
 * The only React file in `@story/canvas` (VISUALIZER_PLAN §3.1: "one host component, ~40 lines:
 * a `div`, a `ResizeObserver`, scene lifecycle"). React is a *peer* dependency and is reachable
 * only through the `./react` subpath, so a consumer that just wants a scene never pulls it in.
 *
 * What this component deliberately does **not** do is render the scene's contents. §2 rejected
 * `react-konva` because the Visualizer's state is mobx class stores driving imperative scene
 * objects, and putting a reconciler in the middle would re-render React on every drag frame.
 * The same reasoning applies here: this component mounts a `Scene` and then gets out of the way.
 * Nothing about the canvas is React state, so nothing about it re-renders.
 *
 * `onReady` is the seam. It runs once, after mount, and returns an optional teardown — the
 * natural place for a store to attach its objects and tools, and to detach them again.
 */

export type TCanvasHostProps = {
    /**
     * Called once the scene is mounted and sized. Return a cleanup function to be run before
     * the scene is destroyed. This is where a store wires up its objects and `ToolManager`.
     */
    onReady?: (scene: Scene) => void | (() => void);

    /** Scene options other than the renderer, which this component owns. */
    sceneOptions?: Omit<TSceneOptions, 'renderer'>;

    className?: string;
    style?: CSSProperties;
};

const fillStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    // The canvas is an absolutely-positioned child of this div; without `relative` it would
    // escape to the nearest positioned ancestor and land somewhere else on the page.
    position: 'relative',
    overflow: 'hidden',
    // Otherwise a drag on the canvas selects the surrounding page text.
    userSelect: 'none',
    // Konva's own touch handling needs the browser's gestures out of the way.
    touchAction: 'none',
};

export const CanvasHost = ({
    onReady,
    sceneOptions,
    className,
    style,
}: TCanvasHostProps) => {
    const containerRef = useRef<HTMLDivElement | null>(null);

    // The latest `onReady` without it being an effect dependency: a caller passing an inline
    // arrow — which is every caller — would otherwise tear the scene down on every render.
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;

    // Same for the options object, which is also an inline literal at every call site.
    const sceneOptionsRef = useRef(sceneOptions);
    sceneOptionsRef.current = sceneOptions;

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const scene = new Scene({
            ...sceneOptionsRef.current,
            renderer: new KonvaRenderer(),
        });
        scene.mount(container);

        const cleanup = onReadyRef.current?.(scene);

        return () => {
            cleanup?.();
            scene.destroy();
        };
        // Deliberately empty: the scene's lifetime is the component's, and every prop that
        // could change is read through a ref above.
    }, []);

    return (
        <div
            ref={containerRef}
            className={className}
            style={{ ...fillStyle, ...style }}
        />
    );
};
