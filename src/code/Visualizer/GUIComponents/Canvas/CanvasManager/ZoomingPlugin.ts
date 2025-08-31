import { CanvasPluginBase } from "./CanvasPluginBase";
import { IPluginWithControls } from "./ICanvasPlugin";
import { TPoint, TSize } from "./CanvasWorld";
import { isValidKeyCode, KeyCode, KeyCodeType } from "./InputConstants";

/**
 * Configuration for zooming behavior
 */
export interface IZoomingConfig {
    enableWheelZoom: boolean;
    enableKeyboardZoom: boolean;
    zoomFactor: number;
    maxZoom: number;
    minZoom: number;
    invertWheelZoom: boolean;
    zoomKeys: {
        zoomIn: KeyCodeType[];
        zoomOut: KeyCodeType[];
        resetZoom: KeyCodeType[];
    };
    smoothZooming: boolean;
    zoomSmoothingFactor: number;
    zoomAtCursor: boolean;
    preventWheelDefault: boolean;
    keyboardZoomSpeed: number;
}

/**
 * Controls exposed by the zooming plugin
 */
export interface IZoomingControls {
    setConfig(config: Partial<IZoomingConfig>): void;
    getConfig(): Readonly<IZoomingConfig>;
    zoomIn(centerAtPoint?: TPoint): void;
    zoomOut(centerAtPoint?: TPoint): void;
    zoomAtPoint(screenPoint: TPoint, zoomFactor: number): void;
    setZoomLevel(zoom: number, centerAtPoint?: TPoint): void;
    resetZoom(): void;
    getZoomLevel(): number;
    getTargetZoomLevel(): number;
    isCurrentlyZooming(): boolean;
    fitToRect(worldRect: IWorldRect, padding?: number): void;
    getZoomLimits(): IZoomLimits;
}

export interface IWorldRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface IZoomLimits {
    min: number;
    max: number;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: IZoomingConfig = {
    enableWheelZoom: true,
    enableKeyboardZoom: true,
    zoomFactor: 1.1,
    maxZoom: 10,
    minZoom: 0.1,
    invertWheelZoom: false,
    zoomKeys: {
        zoomIn: [KeyCode.EQUAL, KeyCode.NUMPAD_ADD, KeyCode.KEY_Z],
        zoomOut: [KeyCode.MINUS, KeyCode.NUMPAD_SUBTRACT, KeyCode.KEY_X],
        resetZoom: [KeyCode.NUMPAD_0, KeyCode.KEY_0]
    },
    smoothZooming: true,
    zoomSmoothingFactor: 0.2,
    zoomAtCursor: true,
    preventWheelDefault: true,
    keyboardZoomSpeed: 1.2
};

/**
 * Plugin that adds zooming functionality to the canvas
 */
export class ZoomingPlugin extends CanvasPluginBase implements IPluginWithControls<IZoomingControls> {
    readonly name = "ZoomingPlugin";

    private config: IZoomingConfig;
    private zoomState: ZoomState;
    private animationLoop: ZoomAnimationLoop;
    private eventHandlers: ZoomEventHandlers;

    constructor(initialConfig?: Partial<IZoomingConfig>) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...initialConfig };
        this.zoomState = new ZoomState();
        this.animationLoop = new ZoomAnimationLoop(() => this.updateSmoothZoom());
        this.eventHandlers = new ZoomEventHandlers(this);
    }

    protected onInitialize(): void {
        const core = this.requireCore();

        // Initialize zoom state from current canvas world state
        const initialPixelSize = core.canvasWorld.pixelSizeInWorldUnits.width;
        const initialScale = 1 / initialPixelSize;
        this.zoomState.setScales(initialScale, initialScale);

        this.eventHandlers.registerAll();
    }

    protected onDestroy(): void {
        this.animationLoop.stop();
        this.eventHandlers.unregisterAll();
    }

    protected onEnable(): void {
        if (this.config.smoothZooming) {
            this.animationLoop.start();
        }
    }

    protected onDisable(): void {
        this.animationLoop.stop();
        this.zoomState.reset();
    }

    getControls(): IZoomingControls {
        return new ZoomingControls(this);
    }

    /**
     * Internal method to update configuration
     */
    updateConfig(newConfig: Partial<IZoomingConfig>): void {
        const oldSmoothZooming = this.config.smoothZooming;

        this.config = {
            ...this.config,
            ...newConfig,
            zoomKeys: {
                ...this.config.zoomKeys,
                ...(newConfig.zoomKeys || {})
            }
        };

        if (this.isEnabled() && this.config.smoothZooming !== oldSmoothZooming) {
            if (this.config.smoothZooming) {
                this.animationLoop.start();
            } else {
                this.animationLoop.stop();
                this.zoomState.snapToTarget();
                this.applyCurrentScale();
            }
        }
    }

    getConfiguration(): Readonly<IZoomingConfig> {
        return { ...this.config };
    }

    /**
     * Handle wheel events
     */
    handleWheel(event: WheelEvent, screenPoint: TPoint, worldPoint: TPoint): boolean {
        if (!this.config.enableWheelZoom) {
            return false;
        }

        if (this.config.preventWheelDefault) {
            event.preventDefault();
        }

        const delta = event.deltaY;
        const zoomIn = this.config.invertWheelZoom ? delta > 0 : delta < 0;
        const relativeScaleFactor = zoomIn ? this.config.zoomFactor : 1 / this.config.zoomFactor;

        const zoomPoint = this.config.zoomAtCursor ? screenPoint : this.getCenterPoint();

        this.performZoom(relativeScaleFactor, zoomPoint);
        return true;
    }

    /**
     * Handle key down events
     */
    handleKeyDown(event: KeyboardEvent): boolean {
        const key = event.code;
        if (!isValidKeyCode(key) || !this.config.enableKeyboardZoom) {
            return false;
        }

        if (this.config.zoomKeys.zoomIn.includes(key)) {
            this.performZoom(this.config.keyboardZoomSpeed, this.getCenterPoint());
            event.preventDefault();
            return true;
        } else if (this.config.zoomKeys.zoomOut.includes(key)) {
            this.performZoom(1 / this.config.keyboardZoomSpeed, this.getCenterPoint());
            event.preventDefault();
            return true;
        } else if (this.config.zoomKeys.resetZoom.includes(key)) {
            this.resetZoomInternal();
            event.preventDefault();
            return true;
        }

        return false;
    }

    /**
     * Perform zoom operation
     */
    performZoom(relativeScaleFactor: number, screenPoint: TPoint): void {
        const core = this.requireCore();

        let newTargetScale = this.zoomState.getTargetScale() * relativeScaleFactor;
        newTargetScale = Math.max(this.config.minZoom, Math.min(this.config.maxZoom, newTargetScale));

        if (Math.abs(newTargetScale - this.zoomState.getTargetScale()) < 0.0001) {
            return;
        }

        const worldPointAtZoomStart = core.canvasWorld.screenToWorld(screenPoint);

        if (!this.config.smoothZooming) {
            core.canvasWorld.zoomAtPoint(screenPoint, relativeScaleFactor);
            this.zoomState.setScales(newTargetScale, newTargetScale);
        } else {
            this.zoomState.setSmoothZoomTarget(newTargetScale, screenPoint, worldPointAtZoomStart);
        }
    }

    /**
     * Set zoom level directly
     */
    setZoomLevelInternal(newZoomLevel: number, centerAtPoint?: TPoint): void {
        newZoomLevel = Math.max(this.config.minZoom, Math.min(this.config.maxZoom, newZoomLevel));
        const relativeScaleFactor = newZoomLevel / this.zoomState.getTargetScale();

        if (Math.abs(relativeScaleFactor - 1) > 0.0001) {
            const zoomPoint = centerAtPoint || this.getCenterPoint();
            this.performZoom(relativeScaleFactor, zoomPoint);
        }
    }

    /**
     * Reset zoom to 1:1
     */
    resetZoomInternal(): void {
        const core = this.requireCore();

        this.zoomState.setTargetScale(1);

        if (!this.config.smoothZooming) {
            this.zoomState.setCurrentScale(1);
            const newPixelSize: TSize = { width: 1, height: 1 };
            core.canvasWorld.pixelSizeInWorldUnits = newPixelSize;
        }

        this.zoomState.clearSmoothZoomTarget();
    }

    /**
     * Fit view to a world rectangle
     */
    fitToRectInternal(worldRect: IWorldRect, padding: number): void {
        const core = this.requireCore();

        const canvasWidth = core.canvas.width - padding * 2;
        const canvasHeight = core.canvas.height - padding * 2;

        const zoomX = canvasWidth / worldRect.width;
        const zoomY = canvasHeight / worldRect.height;
        let newZoom = Math.min(zoomX, zoomY);

        newZoom = Math.max(this.config.minZoom, Math.min(this.config.maxZoom, newZoom));

        const centerX = worldRect.x + worldRect.width / 2;
        const centerY = worldRect.y + worldRect.height / 2;

        const newPixelSize: TSize = { width: 1 / newZoom, height: 1 / newZoom };

        const newViewPosition: TPoint = {
            x: centerX - (core.canvas.width / 2) * newPixelSize.width,
            y: centerY - (core.canvas.height / 2) * newPixelSize.height
        };

        core.canvasWorld.atomicZoomAndPositionUpdate({
            pixelSizeInWorldUnits: newPixelSize,
            viewPosition: newViewPosition
        });

        this.zoomState.setScales(newZoom, newZoom);
        this.zoomState.clearSmoothZoomTarget();
    }

    /**
     * Get current zoom state
     */
    getZoomState(): { current: number; target: number; isZooming: boolean } {
        return {
            current: this.zoomState.getCurrentScale(),
            target: this.zoomState.getTargetScale(),
            isZooming: this.zoomState.isZooming()
        };
    }

    private getCenterPoint(): TPoint {
        const core = this.requireCore();
        return { x: core.canvas.width / 2, y: core.canvas.height / 2 };
    }

    private updateSmoothZoom(): void {
        if (!this.core) {
            return;
        }

        const hasChanged = this.zoomState.updateSmoothZoom(this.config.zoomSmoothingFactor);

        if (hasChanged) {
            this.applyCurrentScale();
        }
    }

    private applyCurrentScale(): void {
        const core = this.requireCore();
        const currentScale = this.zoomState.getCurrentScale();
        const newPixelSize: TSize = { width: 1 / currentScale, height: 1 / currentScale };

        const smoothTarget = this.zoomState.getSmoothZoomTarget();
        if (smoothTarget) {
            const newViewPosition: TPoint = {
                x: smoothTarget.worldPoint.x - smoothTarget.screenPoint.x * newPixelSize.width,
                y: smoothTarget.worldPoint.y - smoothTarget.screenPoint.y * newPixelSize.height
            };

            core.canvasWorld.atomicZoomAndPositionUpdate({
                pixelSizeInWorldUnits: newPixelSize,
                viewPosition: newViewPosition
            });
        } else {
            core.canvasWorld.pixelSizeInWorldUnits = newPixelSize;
        }

        // Clear only after applying the update, and only if done zooming
        if (!this.zoomState.isZooming()) {
            this.zoomState.clearSmoothZoomTarget();
        }
    }
}

/**
 * Manages the state of zoom operations
 */
class ZoomState {
    private currentScale = 1;
    private targetScale = 1;
    private isZoomingFlag = false;
    private smoothZoomTarget: SmoothZoomTarget | null = null;

    setCurrentScale(scale: number): void {
        this.currentScale = scale;
    }

    getCurrentScale(): number {
        return this.currentScale;
    }

    setTargetScale(scale: number): void {
        this.targetScale = scale;
    }

    getTargetScale(): number {
        return this.targetScale;
    }

    setScales(current: number, target: number): void {
        this.currentScale = current;
        this.targetScale = target;
    }

    isZooming(): boolean {
        return this.isZoomingFlag;
    }

    setSmoothZoomTarget(targetScale: number, screenPoint: TPoint, worldPoint: TPoint): void {
        this.targetScale = targetScale;
        this.smoothZoomTarget = {
            screenPoint: { ...screenPoint },
            worldPoint: { ...worldPoint }
        };
    }

    getSmoothZoomTarget(): SmoothZoomTarget | null {
        return this.smoothZoomTarget;
    }

    clearSmoothZoomTarget(): void {
        this.smoothZoomTarget = null;
    }

    updateSmoothZoom(smoothingFactor: number): boolean {
        const oldScale = this.currentScale;
        const diff = this.targetScale - this.currentScale;
        let changed = false;

        if (Math.abs(diff) < 0.0001) {
            if (this.currentScale !== this.targetScale) {
                this.currentScale = this.targetScale;
                changed = true;
            }
            this.isZoomingFlag = false;
        } else {
            this.currentScale += diff * smoothingFactor;
            changed = true;
            if (Math.abs(this.targetScale - this.currentScale) < 0.0001) {
                this.currentScale = this.targetScale;
                this.isZoomingFlag = false;
            } else {
                this.isZoomingFlag = true;
            }
        }
        return changed;
    }

    snapToTarget(): void {
        this.currentScale = this.targetScale;
        this.isZoomingFlag = false;
        this.smoothZoomTarget = null;
    }

    reset(): void {
        this.currentScale = 1;
        this.targetScale = 1;
        this.isZoomingFlag = false;
        this.smoothZoomTarget = null;
    }
}

interface SmoothZoomTarget {
    screenPoint: TPoint;
    worldPoint: TPoint;
}

/**
 * Manages the animation loop for smooth zooming
 */
class ZoomAnimationLoop {
    private animationFrameId: number | null = null;
    private callback: () => void;

    constructor(callback: () => void) {
        this.callback = callback;
    }

    start(): void {
        if (this.animationFrameId !== null) {
            return;
        }

        const animate = () => {
            this.callback();
            this.animationFrameId = requestAnimationFrame(animate);
        };

        animate();
    }

    stop(): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    isRunning(): boolean {
        return this.animationFrameId !== null;
    }
}

/**
 * Manages event handler registration for zooming
 */
class ZoomEventHandlers {
    private plugin: ZoomingPlugin;
    private registeredKeys = new Set<KeyCodeType>();

    constructor(plugin: ZoomingPlugin) {
        this.plugin = plugin;
    }

    registerAll(): void {
        const core = this.plugin['requireCore']();
        const config = this.plugin.getConfiguration();

        // Register wheel handler
        core.eventDispatcher.registerWheel((e, sp, wp) => this.plugin.handleWheel(e, sp, wp));

        // Register keyboard handlers for all zoom keys
        const allKeys = this.collectAllKeys(config.zoomKeys);
        for (const key of allKeys) {
            core.eventDispatcher.registerKeyDown(key, e => this.plugin.handleKeyDown(e));
            this.registeredKeys.add(key);
        }
    }

    unregisterAll(): void {
        // Note: Currently no unregister methods in eventDispatcher
        // This would need to be implemented in the core
        this.registeredKeys.clear();
    }

    private collectAllKeys(zoomKeys: IZoomingConfig['zoomKeys']): Set<KeyCodeType> {
        const keys = new Set<KeyCodeType>();

        zoomKeys.zoomIn.forEach(k => keys.add(k));
        zoomKeys.zoomOut.forEach(k => keys.add(k));
        zoomKeys.resetZoom.forEach(k => keys.add(k));

        return keys;
    }
}

/**
 * Implementation of controls exposed to external code
 */
class ZoomingControls implements IZoomingControls {
    constructor(private plugin: ZoomingPlugin) { }

    setConfig(config: Partial<IZoomingConfig>): void {
        this.plugin.updateConfig(config);
    }

    getConfig(): Readonly<IZoomingConfig> {
        return this.plugin.getConfiguration();
    }

    zoomIn(centerAtPoint?: TPoint): void {
        const config = this.plugin.getConfiguration();
        const zoomPoint = centerAtPoint || this.getCenterPoint();
        this.plugin.performZoom(config.zoomFactor, zoomPoint);
    }

    zoomOut(centerAtPoint?: TPoint): void {
        const config = this.plugin.getConfiguration();
        const zoomPoint = centerAtPoint || this.getCenterPoint();
        this.plugin.performZoom(1 / config.zoomFactor, zoomPoint);
    }

    zoomAtPoint(screenPoint: TPoint, zoomFactor: number): void {
        this.plugin.performZoom(zoomFactor, screenPoint);
    }

    setZoomLevel(zoom: number, centerAtPoint?: TPoint): void {
        this.plugin.setZoomLevelInternal(zoom, centerAtPoint);
    }

    resetZoom(): void {
        this.plugin.resetZoomInternal();
    }

    getZoomLevel(): number {
        return this.plugin.getZoomState().current;
    }

    getTargetZoomLevel(): number {
        return this.plugin.getZoomState().target;
    }

    isCurrentlyZooming(): boolean {
        return this.plugin.getZoomState().isZooming;
    }

    fitToRect(worldRect: IWorldRect, padding: number = 20): void {
        this.plugin.fitToRectInternal(worldRect, padding);
    }

    getZoomLimits(): IZoomLimits {
        const config = this.plugin.getConfiguration();
        return { min: config.minZoom, max: config.maxZoom };
    }

    private getCenterPoint(): TPoint {
        const core = this.plugin['requireCore']();
        return { x: core.canvas.width / 2, y: core.canvas.height / 2 };
    }
}