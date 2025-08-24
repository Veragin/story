import { CanvasManagerBase } from "./CanvasManagerBase";

/**
 * Mouse button constants for consistent button identification
 */
export const MouseButton = {
    LEFT: 0,
    MIDDLE: 1,
    RIGHT: 2,
    BACK: 3,
    FORWARD: 4
} as const;

export type MouseButtonType = typeof MouseButton[keyof typeof MouseButton];

/**
 * Common keyboard key constants using KeyboardEvent.code values (more reliable)
 */
export const KeyCode = {
    // Arrow keys
    ARROW_UP: 'ArrowUp',
    ARROW_DOWN: 'ArrowDown',
    ARROW_LEFT: 'ArrowLeft',
    ARROW_RIGHT: 'ArrowRight',
    
    // WASD
    KEY_W: 'KeyW',
    KEY_A: 'KeyA',
    KEY_S: 'KeyS',
    KEY_D: 'KeyD',
    
    // Numpad
    NUMPAD_8: 'Numpad8',
    NUMPAD_2: 'Numpad2',
    NUMPAD_4: 'Numpad4',
    NUMPAD_6: 'Numpad6',
    NUMPAD_5: 'Numpad5',
    
    // Special keys
    SPACE: 'Space',
    ENTER: 'Enter',
    ESCAPE: 'Escape',
    HOME: 'Home',
    KEY_R: 'KeyR',
    
    // Zoom keys (added for ZoomableCanvasManager)
    EQUAL: 'Equal',
    MINUS: 'Minus',
    NUMPAD_ADD: 'NumpadAdd',
    NUMPAD_SUBTRACT: 'NumpadSubtract',
    KEY_Z: 'KeyZ',
    KEY_X: 'KeyX'
} as const;

export type KeyCodeType = typeof KeyCode[keyof typeof KeyCode];

/**
 * Type guard to check if a string is a valid KeyCodeType
 */
export function isValidKeyCode(key: string): key is KeyCodeType {
    return Object.values(KeyCode).includes(key as KeyCodeType);
}

/**
 * Configuration interface for customizing panning behavior
 */
export interface PanableCanvasConfig {
    /** Speed of keyboard panning in pixels per frame */
    keyboardPanSpeed?: number;

    panCursor?: string;
    defaultCursor?: string;
    panMouseButton?: MouseButtonType;
    enableKeyboardPan?: boolean;
    
    enableMousePan?: boolean;
    
    invertPanX?: boolean;
    invertPanY?: boolean;
    
    panKeys?: {
        up?: KeyCodeType[];
        down?: KeyCodeType[];
        left?: KeyCodeType[];
        right?: KeyCodeType[];
        reset?: KeyCodeType[];
    };
    
    smoothPanning?: boolean;
    
    smoothingFactor?: number;
    
    panBounds?: {
        minX?: number;
        maxX?: number;
        minY?: number;
        maxY?: number;
    };
}

/**
 * Default configuration for the panable canvas manager
 */
const DEFAULT_CONFIG: Required<PanableCanvasConfig> = {
    keyboardPanSpeed: 15,
    panCursor: 'grabbing',
    defaultCursor: '',
    panMouseButton: MouseButton.RIGHT,
    enableKeyboardPan: true,
    enableMousePan: true,
    invertPanX: false,
    invertPanY: false,
    panKeys: {
        up: [KeyCode.ARROW_UP, KeyCode.KEY_W, KeyCode.NUMPAD_8],
        down: [KeyCode.ARROW_DOWN, KeyCode.KEY_S, KeyCode.NUMPAD_2],
        left: [KeyCode.ARROW_LEFT, KeyCode.KEY_A, KeyCode.NUMPAD_4],
        right: [KeyCode.ARROW_RIGHT, KeyCode.KEY_D, KeyCode.NUMPAD_6],
        reset: [KeyCode.HOME, KeyCode.NUMPAD_5, KeyCode.ESCAPE, KeyCode.KEY_R]
    },
    smoothPanning: true,
    smoothingFactor: 0.15,
    panBounds: {
        minX: undefined,
        maxX: undefined,
        minY: undefined,
        maxY: undefined
    }
};

/**
 * Canvas manager that supports panning (moving the viewport) without zooming
 */
export class PanableCanvasManager extends CanvasManagerBase {
    protected config: Required<PanableCanvasConfig>;
    protected isPanning: boolean = false;
    protected lastPanPoint: TPoint | null = null;
    protected keysPressed: Set<KeyCodeType> = new Set();
    protected animationFrameId: number | null = null;
    protected panVelocity: TPoint = { x: 0, y: 0 };
    
    constructor(canvas: HTMLCanvasElement, config?: PanableCanvasConfig) {
        super(canvas);
        
        // Merge provided config with defaults
        this.config = {
            ...DEFAULT_CONFIG,
            ...config,
            panKeys: {
                ...DEFAULT_CONFIG.panKeys,
                ...(config?.panKeys || {})
            },
            panBounds: {
                ...DEFAULT_CONFIG.panBounds,
                ...(config?.panBounds || {})
            }
        };
        
        this.initializeEventListeners();
        this.updateCanvasCursor();
    }
    
    protected initializeEventListeners(): void {
        if (this.config.enableKeyboardPan) {
            document.addEventListener('keydown', this.handleKeyDown);
            document.addEventListener('keyup', this.handleKeyUp);
        }
        
        // Start animation loop for smooth keyboard panning
        if (this.config.enableKeyboardPan && this.config.smoothPanning) {
            this.startAnimationLoop();
        }
    }

    protected handleKeyDown (event: KeyboardEvent): void {
        if (!this.config.enableKeyboardPan) return;
        
        const key = event.code;

        if (!isValidKeyCode(key)) return;
        
        this.keysPressed.add(key);
        
        // Check for reset key
        if (this.config.panKeys.reset?.includes(key)) {
            this.resetViewPosition();
            event.preventDefault();
        }
        
        // Prevent default behavior for pan keys
        const allPanKeys = [
            ...(this.config.panKeys.up || []),
            ...(this.config.panKeys.down || []),
            ...(this.config.panKeys.left || []),
            ...(this.config.panKeys.right || [])
        ];
        if (allPanKeys.includes(key)) {
            event.preventDefault();
        }
    };
    
    protected handleKeyUp = (event: KeyboardEvent): void => {
        const key = event.code;
        if (isValidKeyCode(key)) {
            this.keysPressed.delete(key);
        }
    };
    
    protected startAnimationLoop(): void {
        const animate = () => {
            this.updateKeyboardPanning();
            this.animationFrameId = requestAnimationFrame(animate);
        };
        animate();
    }
    
    protected updateKeyboardPanning(): void {
        if (!this.config.enableKeyboardPan) 
            return;
        
        let dx = 0;
        let dy = 0;
        const speed = this.config.keyboardPanSpeed;
        
        // Calculate pan direction based on pressed keys
        for (const key of this.keysPressed) {
            if (this.config.panKeys.up?.includes(key)) dy -= speed;
            if (this.config.panKeys.down?.includes(key)) dy += speed;
            if (this.config.panKeys.left?.includes(key)) dx -= speed;
            if (this.config.panKeys.right?.includes(key)) dx += speed;
        }
        
        // Apply inversion if configured
        if (this.config.invertPanX) dx = -dx;
        if (this.config.invertPanY) dy = -dy;
        
        // Apply smooth panning
        if (this.config.smoothPanning) {
            const factor = this.config.smoothingFactor;
            this.panVelocity.x = this.panVelocity.x * (1 - factor) + dx * factor;
            this.panVelocity.y = this.panVelocity.y * (1 - factor) + dy * factor;
            
            // Only pan if velocity is significant
            if (Math.abs(this.panVelocity.x) > 0.1 || Math.abs(this.panVelocity.y) > 0.1) {
                this.pan({ x: -this.panVelocity.x, y: -this.panVelocity.y });
            }
        } else if (dx !== 0 || dy !== 0) {
            this.pan({ x: -dx, y: -dy });
        }
    }
    
    protected onMouseDownPre(event: MouseEvent, screenPoint: TPoint, worldPoint: TPoint): boolean {
        if (!this.config.enableMousePan) return false;
        
        // Check if the correct mouse button is pressed for panning
        if (event.button === this.config.panMouseButton) {
            this.isPanning = true;
            this.lastPanPoint = screenPoint;
            this.canvas.style.cursor = this.config.panCursor;
            return true; // Event handled
        }
        
        return false;
    }
    
    protected onMouseMovePre(event: MouseEvent, screenPoint: TPoint): boolean {
        if (!this.config.enableMousePan || !this.isPanning || !this.lastPanPoint) {
            return false;
        }
        
        const dx = screenPoint.x - this.lastPanPoint.x;
        const dy = screenPoint.y - this.lastPanPoint.y;
        
        // Apply inversion if configured
        const panDx = this.config.invertPanX ? -dx : dx;
        const panDy = this.config.invertPanY ? -dy : dy;
        
        this.pan({ x: panDx, y: panDy });
        this.lastPanPoint = screenPoint;
        
        return true; // Event handled
    }
    
    protected onMouseUpPre(event: MouseEvent, screenPoint: TPoint, worldPoint: TPoint): void {
        if (this.isPanning) {
            this.isPanning = false;
            this.lastPanPoint = null;
            this.updateCanvasCursor();
        }
    }
    
    /**
     * Pan the view by a given delta (in screen coordinates)
     */
    protected pan(delta: TPoint): void {
        // Apply bounds checking if configured
        const worldDelta = {
            x: this.canvasWorld.screenLengthToWorld(delta.x),
            y: this.canvasWorld.screenLengthToWorld(delta.y)
        };
        
        const currentPos = this.canvasWorld.viewPosition;
        let newX = currentPos.x - worldDelta.x;
        let newY = currentPos.y - worldDelta.y;
        
        // Apply bounds if configured
        if (this.config.panBounds.minX !== undefined) {
            newX = Math.max(this.config.panBounds.minX, newX);
        }
        if (this.config.panBounds.maxX !== undefined) {
            newX = Math.min(this.config.panBounds.maxX, newX);
        }
        if (this.config.panBounds.minY !== undefined) {
            newY = Math.max(this.config.panBounds.minY, newY);
        }
        if (this.config.panBounds.maxY !== undefined) {
            newY = Math.min(this.config.panBounds.maxY, newY);
        }
        
        this.canvasWorld.viewPosition = { x: newX, y: newY };
    }
    
    protected resetViewPosition(): void {
        this.canvasWorld.resetViewPosition();
        this.panVelocity = { x: 0, y: 0 };
    }
    
    protected updateCanvasCursor(): void {
        if (this.config.enableMousePan && !this.isPanning) {
            this.canvas.style.cursor = this.config.defaultCursor;
        } else if (!this.config.enableMousePan) {
            this.canvas.style.cursor = 'default';
        }
    }
    
    protected applyViewportTransformation(ctx: CanvasRenderingContext2D): void {
        const viewPos = this.canvasWorld.viewPosition;
        const scale = 1 / this.canvasWorld.pixelSizeInWorldUnits;
        
        // Apply translation for panning
        ctx.translate(-viewPos.x * scale, -viewPos.y * scale);
        
        // Note: No scaling applied since this is pan-only
    }
    
    /**
     * Set new configuration options
     */
    public setConfig(config: Partial<PanableCanvasConfig>): void {
        this.config = {
            ...this.config,
            ...config,
            panKeys: {
                ...this.config.panKeys,
                ...(config.panKeys || {})
            },
            panBounds: {
                ...this.config.panBounds,
                ...(config.panBounds || {})
            }
        };
        this.updateCanvasCursor();
    }
    
    /**
     * Get current configuration
     */
    public getConfig(): Required<PanableCanvasConfig> {
        return { ...this.config };
    }
    
    /**
     * Enable or disable different panning methods
     */
    public setPanningEnabled(mouse: boolean, keyboard: boolean): void {
        this.config.enableMousePan = mouse;
        this.config.enableKeyboardPan = keyboard;
        this.updateCanvasCursor();
    }
    
    /**
     * Set pan boundaries
     */
    public setPanBounds(bounds: PanableCanvasConfig['panBounds']): void {
        this.config.panBounds = {
            ...this.config.panBounds,
            ...bounds
        };
    }
    
    /**
     * Get current pan bounds
     */
    public getPanBounds(): Required<PanableCanvasConfig>['panBounds'] {
        return { ...this.config.panBounds };
    }
    
    protected destroy(): void {
        // Clean up event listeners
        if (this.config.enableKeyboardPan) {
            document.removeEventListener('keydown', this.handleKeyDown);
            document.removeEventListener('keyup', this.handleKeyUp);
        }

        // Stop animation loop
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
        }
        
        // Call parent destroy
        super.destroy();
    }
}