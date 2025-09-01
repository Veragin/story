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
        resetZoom: [KeyCode.NUMPAD_0, KeyCode.KEY0]
    },
    smoothZooming: true,
    zoomSmoothingFactor: 0.2,
    zoomAtCursor: true,
    preventWheelDefault: true,
    keyboardZoomSpeed: 1.2
};

interface SmoothZoomTarget {
    screenPoint: TPoint;
    worldPoint: TPoint;
}

/**
 * Plugin that adds zooming functionality to the canvas
 */
export class ZoomingPlugin extends CanvasPluginBase implements IPluginWithControls<IZoomingControls> {
    readonly name = "ZoomingPlugin";

    private config: IZoomingConfig;
    private currentScale = 1;
    private targetScale = 1;
    private smoothZoomTarget: SmoothZoomTarget | null = null;
    private animationFrameId: number | null = null;
    private eventHandlers: ZoomEventHandlers;

    constructor(initialConfig?: Partial<IZoomingConfig>) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...initialConfig };
        this.eventHandlers = new ZoomEventHandlers(this);
    }

    protected onInitialize(): void {
        const core = this.requireCore();

        const initialPixelSize = core.canvasWorld.pixelSizeInWorldUnits.width;
        this.currentScale = 1 / initialPixelSize;
        this.targetScale = this.currentScale;

        this.eventHandlers.registerAll();
    }

    protected onDestroy(): void {
        this.stopAnimationLoop();
        this.eventHandlers.unregisterAll();
    }

    protected onEnable(): void {
        if (this.config.smoothZooming) {
            this.startAnimationLoop();
        }
    }

    protected onDisable(): void {
        this.stopAnimationLoop();
        this.currentScale = 1;
        this.targetScale = 1;
        this.smoothZoomTarget = null;
    }

    getControls(): IZoomingControls {
        return new ZoomingControls(this);
    }

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
                this.startAnimationLoop();
            } else {
                this.stopAnimationLoop();
                this.currentScale = this.targetScale;
                this.applyCurrentScale();
            }
        }
    }

    getConfiguration(): Readonly<IZoomingConfig> {
        return { ...this.config };
    }

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

    performZoom(relativeScaleFactor: number, screenPoint: TPoint): void {
        const core = this.requireCore();

        // If smooth zooming and currently animating, snap to target first
        if (this.config.smoothZooming && this.isZooming()) {
            this.currentScale = this.targetScale;
            this.applyCurrentScale();
            this.smoothZoomTarget = null;
        }

        // Now calculate with the updated state
        let newTargetScale = this.targetScale * relativeScaleFactor;
        newTargetScale = Math.max(this.config.minZoom, Math.min(this.config.maxZoom, newTargetScale));

        if (Math.abs(newTargetScale - this.targetScale) < 0.0001) {
            return;
        }

        const worldPointAtZoomStart = core.canvasWorld.screenToWorld(screenPoint);

        if (!this.config.smoothZooming) {
            const actualRelativeScaleFactor = newTargetScale / this.currentScale;
            core.canvasWorld.zoomAtPoint(screenPoint, actualRelativeScaleFactor);
            this.currentScale = newTargetScale;
            this.targetScale = newTargetScale;
            this.smoothZoomTarget = null;
        } else {
            this.smoothZoomTarget = {
                screenPoint: { ...screenPoint },
                worldPoint: { ...worldPointAtZoomStart }
            };
            this.targetScale = newTargetScale;
        }
    }

    setZoomLevelInternal(newZoomLevel: number, centerAtPoint?: TPoint): void {
        newZoomLevel = Math.max(this.config.minZoom, Math.min(this.config.maxZoom, newZoomLevel));
        const relativeScaleFactor = newZoomLevel / this.targetScale;

        if (Math.abs(relativeScaleFactor - 1) > 0.0001) {
            const zoomPoint = centerAtPoint || this.getCenterPoint();
            this.performZoom(relativeScaleFactor, zoomPoint);
        } else {
        }
    }

    resetZoomInternal(): void {
        const core = this.requireCore();

        this.targetScale = 1;

        if (!this.config.smoothZooming) {
            this.currentScale = 1;
            const newPixelSize: TSize = { width: 1, height: 1 };
            core.canvasWorld.pixelSizeInWorldUnits = newPixelSize;
        }

        this.smoothZoomTarget = null;
    }

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

        this.currentScale = newZoom;
        this.targetScale = newZoom;
        this.smoothZoomTarget = null;
    }

    getZoomState(): { current: number; target: number; isZooming: boolean } {
        return {
            current: this.currentScale,
            target: this.targetScale,
            isZooming: this.isZooming()
        };
    }

    private getCenterPoint(): TPoint {
        const core = this.requireCore();
        return { x: core.canvas.width / 2, y: core.canvas.height / 2 };
    }

    private startAnimationLoop(): void {
        if (this.animationFrameId !== null) {
            return;
        }

        const animate = () => {
            this.updateSmoothZoom();
            this.animationFrameId = requestAnimationFrame(animate);
        };

        animate();
    }

    private stopAnimationLoop(): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    private updateSmoothZoom(): void {
        if (!this.core) {
            return;
        }

        const diff = this.targetScale - this.currentScale;

        if (Math.abs(diff) < 0.0001) {
            if (this.currentScale !== this.targetScale) {
                this.currentScale = this.targetScale;
                this.applyCurrentScale();
            }
            if (this.smoothZoomTarget) {
                this.smoothZoomTarget = null;
            }
            return;
        }

        this.currentScale += diff * this.config.zoomSmoothingFactor;

        if (Math.abs(this.targetScale - this.currentScale) < 0.0001) {
            this.currentScale = this.targetScale;
        }

        this.applyCurrentScale();
    }

    private applyCurrentScale(): void {
        const core = this.requireCore();
        const newPixelSize: TSize = { width: 1 / this.currentScale, height: 1 / this.currentScale };

        if (this.smoothZoomTarget) {

            const newViewPosition: TPoint = {
                x: this.smoothZoomTarget.worldPoint.x - this.smoothZoomTarget.screenPoint.x * newPixelSize.width,
                y: this.smoothZoomTarget.worldPoint.y - this.smoothZoomTarget.screenPoint.y * newPixelSize.height
            };

            core.canvasWorld.atomicZoomAndPositionUpdate({
                pixelSizeInWorldUnits: newPixelSize,
                viewPosition: newViewPosition
            });
        } else {
            core.canvasWorld.atomicZoomAndPositionUpdate({
                pixelSizeInWorldUnits: newPixelSize
            });
        }
    }

    private isZooming(): boolean {
        return Math.abs(this.targetScale - this.currentScale) > 0.0001;
    }
}

class ZoomEventHandlers {
    private plugin: ZoomingPlugin;
    private registeredKeys = new Set<KeyCodeType>();

    constructor(plugin: ZoomingPlugin) {
        this.plugin = plugin;
    }

    registerAll(): void {
        const core = this.plugin['requireCore']();
        const config = this.plugin.getConfiguration();

        core.eventDispatcher.registerWheel(
            "zoom ",
            (e, sp, wp) => this.plugin.handleWheel(e, sp, wp));

        const allKeys = this.collectAllKeys(config.zoomKeys);
        for (const key of allKeys) {
            core.eventDispatcher.registerKeyDown(
                "zoom " + key,
                key,
                e => this.plugin.handleKeyDown(e)
            );
            this.registeredKeys.add(key);
        }
    }

    unregisterAll(): void {
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