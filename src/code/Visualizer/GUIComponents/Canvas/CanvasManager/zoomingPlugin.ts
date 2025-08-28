import { ICanvasManagerCore } from "./CanvasManagerCore";
import { TPoint, TSize } from "./CanvasWorld";
import { isValidKeyCode, KeyCode, KeyCodeType } from "./InputConstants";

/**
 * Configuration interface for customizing zooming behavior
 */
export interface ZoomableCanvasConfig {
    /** Enable/disable mouse wheel zooming */
    enableWheelZoom?: boolean;

    /** Enable/disable keyboard zooming */
    enableKeyboardZoom?: boolean;

    /** Zoom factor per wheel notch or key press (1.1 = 10% zoom) */
    zoomFactor?: number;

    /** Maximum zoom level (1 = 100%, 10 = 1000%) */
    maxZoom?: number;

    /** Minimum zoom level (0.1 = 10%, 1 = 100%) */
    minZoom?: number;

    /** Invert zoom direction for mouse wheel */
    invertWheelZoom?: boolean;

    /** Keyboard keys for zooming */
    zoomKeys?: {
        zoomIn?: KeyCodeType[];
        zoomOut?: KeyCodeType[];
        resetZoom?: KeyCodeType[];
    };

    smoothZooming?: boolean;

    /** Smoothing factor for zoom animation (0-1, higher = faster) */
    zoomSmoothingFactor?: number;

    /** Whether to zoom at cursor position or center */
    zoomAtCursor?: boolean;

    /** Prevent default wheel behavior (page scroll) */
    preventWheelDefault?: boolean;

    /** Zoom speed multiplier for keyboard zoom */
    keyboardZoomSpeed?: number;
}


/**
 * Default configuration for the zoomable canvas manager
 */
const DEFAULT_ZOOM_CONFIG: Required<ZoomableCanvasConfig> = {
    enableWheelZoom: true,
    enableKeyboardZoom: true,
    zoomFactor: 1.1,
    maxZoom: 10,
    minZoom: 0.1,
    invertWheelZoom: false,
    zoomKeys: {
        zoomIn: [KeyCode.EQUAL, KeyCode.NUMPAD_ADD, KeyCode.KEY_Z],
        zoomOut: [KeyCode.MINUS, KeyCode.NUMPAD_SUBTRACT, KeyCode.KEY_X],
        resetZoom: [KeyCode.NUMPAD_5, KeyCode.NUMPAD_0]
    },
    smoothZooming: true,
    zoomSmoothingFactor: 0.2,
    zoomAtCursor: true,
    preventWheelDefault: true,
    keyboardZoomSpeed: 1.2
};

interface SmoothZoomState {
    zoomPoint: TPoint; // Screen coordinates
    worldPointAtZoomStart: TPoint; // World coordinates at zoom start
}

export interface ZoomingControls {
    setConfig(config: Partial<ZoomableCanvasConfig>): void;
    getConfig(): Required<ZoomableCanvasConfig>;
    zoomIn(centerAtPoint?: TPoint): void;
    zoomOut(centerAtPoint?: TPoint): void;
    zoomAtPoint(screenPoint: TPoint, zoomFactor: number): void;
    setZoomLevel(zoom: number, centerAtPoint?: TPoint): void;
    resetZoom(): void;
    getZoomLevel(): number;
    getTargetZoomLevel(): number;
    isCurrentlyZooming(): boolean;
    fitToRect(worldRect: { x: number; y: number; width: number; height: number }, padding?: number): void;
    getZoomLimits(): { min: number; max: number };
}

export function zoomingPlugin(initialConfig?: ZoomableCanvasConfig): { plugin: (core: ICanvasManagerCore) => void; controls: ZoomingControls } {
    let config: Required<ZoomableCanvasConfig> = {
        ...DEFAULT_ZOOM_CONFIG,
        ...initialConfig,
        zoomKeys: {
            ...DEFAULT_ZOOM_CONFIG.zoomKeys,
            ...(initialConfig?.zoomKeys || {})
        }
    };

    let currentScale: number = 1;
    let targetScale: number = 1;
    let isZooming: boolean = false;
    let smoothZoomState: SmoothZoomState | null = null;
    let animationFrameId: number | null = null;
    let coreRef: ICanvasManagerCore | null = null;

    const getCenterPoint = (): TPoint => {
        return { x: coreRef!.canvas.width / 2, y: coreRef!.canvas.height / 2 };
    };

    const startAnimationLoop = () => {
        if (animationFrameId !== null) return;
        const animate = () => {
            updateSmoothZoom();
            animationFrameId = requestAnimationFrame(animate);
        };
        animate();
    };

    const stopAnimationLoop = () => {
        if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    };

    const updateSmoothZoom = () => {
        if (!coreRef) return;

        const diff = targetScale - currentScale;
        if (Math.abs(diff) < 0.0001) {
            currentScale = targetScale;
            isZooming = false;
            smoothZoomState = null;
            return;
        }

        const factor = config.zoomSmoothingFactor;
        const previousScale = currentScale;
        currentScale += diff * factor;
        isZooming = true;
        const newPixelSize: TSize = { width: 1 / currentScale, height: 1 / currentScale };

        if (smoothZoomState) {
            const { zoomPoint, worldPointAtZoomStart } = smoothZoomState;
            const newViewPosition: TPoint = {
                x: worldPointAtZoomStart.x - zoomPoint.x * newPixelSize.width,
                y: worldPointAtZoomStart.y - zoomPoint.y * newPixelSize.height
            };
            coreRef.canvasWorld.atomicZoomAndPositionUpdate({
                pixelSizeInWorldUnits: newPixelSize,
                viewPosition: newViewPosition
            });
        } else {
            coreRef.canvasWorld.pixelSizeInWorldUnits = newPixelSize;
        }
    };

    const zoom = (relativeScaleFactor: number, screenPoint: TPoint) => {
        if (!coreRef) return;

        let newTargetScale = targetScale * relativeScaleFactor;
        newTargetScale = Math.max(config.minZoom, Math.min(config.maxZoom, newTargetScale));

        if (Math.abs(newTargetScale - targetScale) < 0.0001) return;

        const worldPointAtZoomStart = coreRef.canvasWorld.screenToWorld(screenPoint);

        if (!config.smoothZooming) {
            const pixelFactor = relativeScaleFactor; // Fixed: no inversion needed
            coreRef.canvasWorld.zoomAtPoint(screenPoint, pixelFactor);
            currentScale = newTargetScale;
            smoothZoomState = null;
        } else {
            smoothZoomState = {
                zoomPoint: { ...screenPoint },
                worldPointAtZoomStart: { ...worldPointAtZoomStart }
            };
        }

        targetScale = newTargetScale;
    };

    const handleWheel = (event: WheelEvent, screenPoint: TPoint, worldPoint: TPoint): boolean => {
        if (!config.enableWheelZoom) return false;

        if (config.preventWheelDefault) {
            event.preventDefault();
        }

        const delta = event.deltaY;
        const zoomIn = config.invertWheelZoom ? delta > 0 : delta < 0;
        const relativeScaleFactor = zoomIn ? config.zoomFactor : 1 / config.zoomFactor;

        const zoomPoint = config.zoomAtCursor ? screenPoint : getCenterPoint();

        zoom(relativeScaleFactor, zoomPoint);
        return true;
    };

    const handleKeyDown = (event: KeyboardEvent): boolean => {
        const key = event.code;
        if (!isValidKeyCode(key)) return false;

        if (config.zoomKeys.zoomIn?.includes(key)) {
            const centerPoint = getCenterPoint();
            zoom(config.keyboardZoomSpeed, centerPoint);
            event.preventDefault();
            return true;
        } else if (config.zoomKeys.zoomOut?.includes(key)) {
            const centerPoint = getCenterPoint();
            zoom(1 / config.keyboardZoomSpeed, centerPoint);
            event.preventDefault();
            return true;
        } else if (config.zoomKeys.resetZoom?.includes(key)) {
            resetZoom();
            event.preventDefault();
            return true;
        }

        return false;
    };

    const plugin = (core: ICanvasManagerCore) => {
        coreRef = core;

        // Initialize current scale from existing pixel size (assuming uniform)
        const initialPixelSize = core.canvasWorld.pixelSizeInWorldUnits.width;
        currentScale = 1 / initialPixelSize;
        targetScale = currentScale;

        core.eventDispatcher.registerWheel(handleWheel);

        // Collect all zoom keys
        const allZoomKeys = new Set<KeyCodeType>();
        [
            ...(config.zoomKeys.zoomIn || []),
            ...(config.zoomKeys.zoomOut || []),
            ...(config.zoomKeys.resetZoom || [])
        ].forEach(key => allZoomKeys.add(key));

        for (const key of allZoomKeys) {
            core.eventDispatcher.registerKeyDown(key, handleKeyDown);
        }

        if (config.smoothZooming) {
            startAnimationLoop();
        }
    };

    const resetZoom = () => {
        if (!coreRef) return;

        targetScale = 1;
        if (!config.smoothZooming) {
            currentScale = 1;
            const newPixelSize: TSize = { width: 1, height: 1 };
            coreRef.canvasWorld.pixelSizeInWorldUnits = newPixelSize;
        }
        smoothZoomState = null;
    };

    const controls: ZoomingControls = {
        setConfig(newConfig: Partial<ZoomableCanvasConfig>): void {
            const oldSmoothZooming = config.smoothZooming;
            const oldEnableKeyboardZoom = config.enableKeyboardZoom;
            const oldEnableWheelZoom = config.enableWheelZoom;

            config = {
                ...config,
                ...newConfig,
                zoomKeys: {
                    ...config.zoomKeys,
                    ...(newConfig.zoomKeys || {})
                }
            };

            if (config.smoothZooming !== oldSmoothZooming) {
                if (config.smoothZooming) {
                    startAnimationLoop();
                } else {
                    stopAnimationLoop();
                    currentScale = targetScale;
                    const newPixelSize: TSize = { width: 1 / currentScale, height: 1 / currentScale };
                    if (coreRef) {
                        coreRef.canvasWorld.pixelSizeInWorldUnits = newPixelSize;
                    }
                    smoothZoomState = null;
                }
            }

            // Note: Dynamic change of keys or wheel not handled; assume initial config
        },

        getConfig(): Required<ZoomableCanvasConfig> {
            return { ...config };
        },

        zoomIn(centerAtPoint?: TPoint): void {
            const zoomPoint = centerAtPoint || getCenterPoint();
            zoom(config.zoomFactor, zoomPoint);
        },

        zoomOut(centerAtPoint?: TPoint): void {
            const zoomPoint = centerAtPoint || getCenterPoint();
            zoom(1 / config.zoomFactor, zoomPoint);
        },

        zoomAtPoint(screenPoint: TPoint, relativeScaleFactor: number): void {
            zoom(relativeScaleFactor, screenPoint);
        },

        setZoomLevel(newZoomLevel: number, centerAtPoint?: TPoint): void {
            newZoomLevel = Math.max(config.minZoom, Math.min(config.maxZoom, newZoomLevel));
            const relativeScaleFactor = newZoomLevel / targetScale;
            if (Math.abs(relativeScaleFactor - 1) > 0.0001) {
                const zoomPoint = centerAtPoint || getCenterPoint();
                zoom(relativeScaleFactor, zoomPoint);
            }
        },

        resetZoom(): void {
            resetZoom();
        },

        getZoomLevel(): number {
            return currentScale;
        },

        getTargetZoomLevel(): number {
            return targetScale;
        },

        isCurrentlyZooming(): boolean {
            return isZooming;
        },

        fitToRect(worldRect: { x: number; y: number; width: number; height: number }, padding: number = 20): void {
            if (!coreRef) return;

            const canvasWidth = coreRef.canvas.width - padding * 2;
            const canvasHeight = coreRef.canvas.height - padding * 2;

            const zoomX = canvasWidth / worldRect.width;
            const zoomY = canvasHeight / worldRect.height;
            let newZoom = Math.min(zoomX, zoomY);

            newZoom = Math.max(config.minZoom, Math.min(config.maxZoom, newZoom));

            const centerX = worldRect.x + worldRect.width / 2;
            const centerY = worldRect.y + worldRect.height / 2;

            const newPixelSize: TSize = { width: 1 / newZoom, height: 1 / newZoom };

            const newViewPosition: TPoint = {
                x: centerX - (coreRef.canvas.width / 2) * newPixelSize.width,
                y: centerY - (coreRef.canvas.height / 2) * newPixelSize.height
            };

            coreRef.canvasWorld.atomicZoomAndPositionUpdate({
                pixelSizeInWorldUnits: newPixelSize,
                viewPosition: newViewPosition
            });

            targetScale = newZoom;
            currentScale = newZoom;
            smoothZoomState = null;
        },

        getZoomLimits(): { min: number; max: number } {
            return { min: config.minZoom, max: config.maxZoom };
        }
    };

    return { plugin, controls };
}