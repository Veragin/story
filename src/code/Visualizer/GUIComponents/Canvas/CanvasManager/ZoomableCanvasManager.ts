import { PanableCanvasManager, PanableCanvasConfig, KeyCode, KeyCodeType, MouseButton, MouseButtonType, isValidKeyCode } from "./PanableCanvasManager";

/**
 * Extended key codes for zooming functionality
 */
export const ZoomKeyCode = {
    ...KeyCode,
    // Zoom-specific keys
    NUMPAD_ADD: 'NumpadAdd',
    NUMPAD_SUBTRACT: 'NumpadSubtract',
    NUMPAD_0: 'Numpad0',
    EQUAL: 'Equal',
    MINUS: 'Minus',
    BRACKET_LEFT: 'BracketLeft',
    BRACKET_RIGHT: 'BracketRight',
    DIGIT_0: 'Digit0',
    KEY_Z: 'KeyZ',
    KEY_X: 'KeyX'
} as const;

export type ZoomKeyCodeType = typeof ZoomKeyCode[keyof typeof ZoomKeyCode];

/**
 * Type guard to check if a string is a valid ZoomKeyCodeType
 */
export function isValidZoomKeyCode(key: string): key is ZoomKeyCodeType {
    return Object.values(ZoomKeyCode).includes(key as ZoomKeyCodeType);
}

/**
 * Configuration interface for customizing zooming behavior
 */
export interface ZoomableCanvasConfig extends PanableCanvasConfig {
    /** Enable/disable mouse wheel zooming */
    enableWheelZoom?: boolean;
    
    /** Enable/disable keyboard zooming */
    enableKeyboardZoom?: boolean;
    
    /** Mouse button for zoom reset (middle button by default) */
    zoomMouseButton?: MouseButtonType;
    
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
        zoomIn?: ZoomKeyCodeType[];
        zoomOut?: ZoomKeyCodeType[];
        resetZoom?: ZoomKeyCodeType[];
    };
    
    /** Smooth zooming animation */
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
const DEFAULT_ZOOM_CONFIG: Required<Omit<ZoomableCanvasConfig, keyof PanableCanvasConfig>> = {
    enableWheelZoom: true,
    enableKeyboardZoom: true,
    zoomMouseButton: MouseButton.MIDDLE,
    zoomFactor: 1.1,
    maxZoom: 10,
    minZoom: 0.1,
    invertWheelZoom: false,
    zoomKeys: {
        zoomIn: [ZoomKeyCode.EQUAL, ZoomKeyCode.NUMPAD_ADD, ZoomKeyCode.KEY_Z, ZoomKeyCode.BRACKET_RIGHT],
        zoomOut: [ZoomKeyCode.MINUS, ZoomKeyCode.NUMPAD_SUBTRACT, ZoomKeyCode.KEY_X, ZoomKeyCode.BRACKET_LEFT],
        resetZoom: [ZoomKeyCode.NUMPAD_5, ZoomKeyCode.NUMPAD_0, ZoomKeyCode.DIGIT_0]
    },
    smoothZooming: true,
    zoomSmoothingFactor: 0.2,
    zoomAtCursor: true,
    preventWheelDefault: true,
    keyboardZoomSpeed: 1.2
};

/**
 * Canvas manager that supports both panning and zooming with smooth animations
 */
export class ZoomableCanvasManager extends PanableCanvasManager {
    private zoomConfig: Required<ZoomableCanvasConfig>;
    private targetZoom: number = 1;
    private currentZoom: number = 1;
    private zoomAnimationId: number | null = null;
    private lastWheelTime: number = 0;
    private wheelTimeout: number | null = null;
    private isZooming: boolean = false;
    
    constructor(canvas: HTMLCanvasElement, config?: ZoomableCanvasConfig) {
        super(canvas, config);
        
        // Merge zoom config with defaults
        this.zoomConfig = {
            ...this.config,
            ...DEFAULT_ZOOM_CONFIG,
            ...config,
            zoomKeys: {
                ...DEFAULT_ZOOM_CONFIG.zoomKeys,
                ...(config?.zoomKeys || {})
            }
        } as Required<ZoomableCanvasConfig>;
        
        // Update the parent config reference
        this.config = this.zoomConfig;
        
        // Initialize zoom-specific event listeners
        this.initializeZoomEventListeners();
        
        // Start zoom animation loop if smooth zooming is enabled
        if (this.zoomConfig.smoothZooming) {
            this.startZoomAnimationLoop();
        }
    }
    
    private initializeZoomEventListeners(): void {
        // Mouse wheel for zooming
        if (this.zoomConfig.enableWheelZoom) {
            this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
        }
        
        // Middle mouse button for zoom reset (optional)
        this.canvas.addEventListener('mousedown', this.handleZoomMouseDown);
    }
    
    private handleWheel = (event: WheelEvent): void => {
        if (!this.zoomConfig.enableWheelZoom) return;
        
        if (this.zoomConfig.preventWheelDefault) {
            event.preventDefault();
        }
        
        // Determine zoom direction
        const delta = event.deltaY;
        const zoomIn = this.zoomConfig.invertWheelZoom ? delta > 0 : delta < 0;
        
        // Calculate zoom factor
        const factor = zoomIn ? this.zoomConfig.zoomFactor : 1 / this.zoomConfig.zoomFactor;
        
        // Get the point to zoom at
        const zoomPoint = this.zoomConfig.zoomAtCursor
            ? this.getMousePoint(event)
            : { x: this.canvas.width / 2, y: this.canvas.height / 2 };
        
        // Apply zoom
        this.zoom(factor, zoomPoint);
        
        // Track wheel events for smooth zooming
        this.lastWheelTime = performance.now();
    };
    
    private handleZoomMouseDown = (event: MouseEvent): void => {
        // Optional: Middle click to reset zoom
        if (event.button === this.zoomConfig.zoomMouseButton) {
            this.resetZoom();
            event.preventDefault();
        }
    };
    
    protected handleKeyDown = (event: KeyboardEvent): void => {
        super.handleKeyDown(event);
        
        if (!this.zoomConfig.enableKeyboardZoom) return;
        
        const key = event.code;
        if (!isValidZoomKeyCode(key)) return;
        
        // Check for zoom keys
        if (this.zoomConfig.zoomKeys.zoomIn?.includes(key)) {
            const centerPoint = { x: this.canvas.width / 2, y: this.canvas.height / 2 };
            this.zoom(this.zoomConfig.keyboardZoomSpeed, centerPoint);
            event.preventDefault();
        } else if (this.zoomConfig.zoomKeys.zoomOut?.includes(key)) {
            const centerPoint = { x: this.canvas.width / 2, y: this.canvas.height / 2 };
            this.zoom(1 / this.zoomConfig.keyboardZoomSpeed, centerPoint);
            event.preventDefault();
        } else if (this.zoomConfig.zoomKeys.resetZoom?.includes(key)) {
            this.resetZoom();
            event.preventDefault();
        }
    };
    
    private startZoomAnimationLoop(): void {
        const animate = () => {
            this.updateSmoothZoom();
            this.zoomAnimationId = requestAnimationFrame(animate);
        };
        animate();
    }
    
    private updateSmoothZoom(): void {
        if (!this.zoomConfig.smoothZooming) return;
        
        // Calculate the difference between target and current zoom
        const diff = this.targetZoom - this.currentZoom;
        
        // If the difference is negligible, stop animating
        if (Math.abs(diff) < 0.0001) {
            this.currentZoom = this.targetZoom;
            this.isZooming = false;
            return;
        }
        
        // Apply smooth interpolation
        const factor = this.zoomConfig.zoomSmoothingFactor;
        this.currentZoom += diff * factor;
        this.isZooming = true;
        
        // Update the actual canvas world zoom
        this.canvasWorld.pixelSizeInWorldUnits = 1 / this.currentZoom;
    }
    
    /**
     * Zoom the view by a given factor at a specific screen point
     */
    private zoom(factor: number, screenPoint: TPoint): void {
        // Calculate new zoom level
        let newZoom = this.targetZoom * factor;
        
        // Apply zoom limits
        newZoom = Math.max(this.zoomConfig.minZoom, Math.min(this.zoomConfig.maxZoom, newZoom));
        
        // If no change, return early
        if (Math.abs(newZoom - this.targetZoom) < 0.0001) return;
        
        // Store the old zoom for calculations
        const oldZoom = this.zoomConfig.smoothZooming ? this.currentZoom : this.targetZoom;
        
        // Update target zoom
        this.targetZoom = newZoom;
        
        // If not using smooth zooming, apply immediately
        if (!this.zoomConfig.smoothZooming) {
            this.currentZoom = newZoom;
            this.canvasWorld.zoomAtPoint(screenPoint, factor);
        } else {
            // For smooth zooming, we need to handle the viewport adjustment
            // Calculate the world point before zoom
            const worldPoint = this.canvasWorld.screenToWorld(screenPoint);
            
            // The smooth zoom animation will handle the actual zoom change
            // We need to adjust the view position to keep the zoom point stable
            const zoomRatio = oldZoom / newZoom;
            
            // Calculate the new view position to keep the zoom point stable
            const currentViewPos = this.canvasWorld.viewPosition;
            const newViewX = worldPoint.x - (worldPoint.x - currentViewPos.x) * zoomRatio;
            const newViewY = worldPoint.y - (worldPoint.y - currentViewPos.y) * zoomRatio;
            
            // Update the view position
            this.canvasWorld.viewPosition = { x: newViewX, y: newViewY };
        }
    }
    
    /**
     * Reset zoom to 1:1 (100%)
     */
    public resetZoom(): void {
        this.targetZoom = 1;
        if (!this.zoomConfig.smoothZooming) {
            this.currentZoom = 1;
            this.canvasWorld.pixelSizeInWorldUnits = 1;
        }
    }
    
    /**
     * Reset both zoom and pan to default view
     */
    public resetView(): void {
        this.resetZoom();
        this.resetViewPosition();
    }
    
    /**
     * Set zoom level directly (1 = 100%, 2 = 200%, etc.)
     */
    public setZoomLevel(zoom: number, centerAtPoint?: TPoint): void {
        zoom = Math.max(this.zoomConfig.minZoom, Math.min(this.zoomConfig.maxZoom, zoom));
        
        const zoomPoint = centerAtPoint || { x: this.canvas.width / 2, y: this.canvas.height / 2 };
        const factor = zoom / this.targetZoom;
        
        if (Math.abs(factor - 1) > 0.0001) {
            this.zoom(factor, zoomPoint);
        }
    }
    
    /**
     * Get current zoom level
     */
    public getZoomLevel(): number {
        return this.currentZoom;
    }
    
    /**
     * Get target zoom level (for smooth zooming)
     */
    public getTargetZoomLevel(): number {
        return this.targetZoom;
    }
    
    /**
     * Check if currently zooming (during smooth zoom animation)
     */
    public isCurrentlyZooming(): boolean {
        return this.isZooming;
    }
    
    /**
     * Zoom in by one step
     */
    public zoomIn(centerAtPoint?: TPoint): void {
        const zoomPoint = centerAtPoint || { x: this.canvas.width / 2, y: this.canvas.height / 2 };
        this.zoom(this.zoomConfig.zoomFactor, zoomPoint);
    }
    
    /**
     * Zoom out by one step
     */
    public zoomOut(centerAtPoint?: TPoint): void {
        const zoomPoint = centerAtPoint || { x: this.canvas.width / 2, y: this.canvas.height / 2 };
        this.zoom(1 / this.zoomConfig.zoomFactor, zoomPoint);
    }
    
    /**
     * Zoom at a specific point with a given factor
     */
    public zoomAtPoint(screenPoint: TPoint, zoomFactor: number): void {
        this.zoom(zoomFactor, screenPoint);
    }
    
    /**
     * Fit a world-space rectangle into view
     */
    public fitToRect(worldRect: { x: number; y: number; width: number; height: number }, padding: number = 20): void {
        const canvasWidth = this.canvas.width - padding * 2;
        const canvasHeight = this.canvas.height - padding * 2;
        
        // Calculate zoom to fit
        const zoomX = canvasWidth / worldRect.width;
        const zoomY = canvasHeight / worldRect.height;
        const zoom = Math.min(zoomX, zoomY);
        
        // Apply zoom limits
        const clampedZoom = Math.max(this.zoomConfig.minZoom, Math.min(this.zoomConfig.maxZoom, zoom));
        
        // Set zoom
        this.targetZoom = clampedZoom;
        if (!this.zoomConfig.smoothZooming) {
            this.currentZoom = clampedZoom;
        }
        
        // Center the rectangle
        const centerX = worldRect.x + worldRect.width / 2;
        const centerY = worldRect.y + worldRect.height / 2;
        
        // Calculate view position to center the rectangle
        this.canvasWorld.viewPosition = {
            x: centerX - (this.canvas.width / 2) * (1 / clampedZoom),
            y: centerY - (this.canvas.height / 2) * (1 / clampedZoom)
        };
    }
    
    /**
     * Get zoom limits
     */
    public getZoomLimits(): { min: number; max: number } {
        return {
            min: this.zoomConfig.minZoom,
            max: this.zoomConfig.maxZoom
        };
    }
    
    protected applyViewportTransformation(ctx: CanvasRenderingContext2D): void {
        const viewPos = this.canvasWorld.viewPosition;
        const scale = this.currentZoom;
        
        // Apply scaling for zoom
        ctx.scale(scale, scale);
        
        // Apply translation for panning
        ctx.translate(-viewPos.x, -viewPos.y);
    }
    
    /**
     * Update configuration
     */
    public setConfig(config: Partial<ZoomableCanvasConfig>): void {
        super.setConfig(config);
        
        // Update zoom-specific config
        this.zoomConfig = {
            ...this.zoomConfig,
            ...config,
            zoomKeys: {
                ...this.zoomConfig.zoomKeys,
                ...(config.zoomKeys || {})
            }
        } as Required<ZoomableCanvasConfig>;
        
        // Re-apply event listeners if needed
        if (config.enableWheelZoom !== undefined) {
            if (config.enableWheelZoom) {
                this.canvas.addEventListener('wheel', this.handleWheel, { passive: false });
            } else {
                this.canvas.removeEventListener('wheel', this.handleWheel);
            }
        }
        
        // Update animation loop based on smooth zooming setting
        if (config.smoothZooming !== undefined) {
            if (config.smoothZooming && !this.zoomAnimationId) {
                this.startZoomAnimationLoop();
            } else if (!config.smoothZooming && this.zoomAnimationId) {
                cancelAnimationFrame(this.zoomAnimationId);
                this.zoomAnimationId = null;
                // Set current zoom to target immediately
                this.currentZoom = this.targetZoom;
                this.canvasWorld.pixelSizeInWorldUnits = 1 / this.currentZoom;
            }
        }
    }
    
    /**
     * Get current configuration
     */
    public getConfig(): Required<ZoomableCanvasConfig> {
        return { ...this.zoomConfig };
    }
    
    protected destroy(): void {
        // Clean up zoom-specific event listeners
        if (this.zoomConfig.enableWheelZoom) {
            this.canvas.removeEventListener('wheel', this.handleWheel);
        }
        this.canvas.removeEventListener('mousedown', this.handleZoomMouseDown);
        
        // Stop zoom animation loop
        if (this.zoomAnimationId !== null) {
            cancelAnimationFrame(this.zoomAnimationId);
            this.zoomAnimationId = null;
        }
        
        // Clear wheel timeout if exists
        if (this.wheelTimeout !== null) {
            clearTimeout(this.wheelTimeout);
            this.wheelTimeout = null;
        }
        
        // Call parent destroy
        super.destroy();
    }
}