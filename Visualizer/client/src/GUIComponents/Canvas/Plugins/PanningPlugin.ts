import { CanvasPluginBase } from "./CanvasPluginBase";
import { TPoint } from "../CanvasManager/CanvasWorld";
import { IPluginWithControls } from "./ICanvasPlugin";
import { isValidKeyCode, KeyCode, KeyCodeType, MouseButton, MouseButtonType } from "../CanvasManager/InputConstants";

/**
 * Configuration for panning behavior
 */
export interface IPanningConfig {
    keyboardPanSpeed: number;
    panCursor: string;
    defaultCursor: string;
    panMouseButton: MouseButtonType;
    enableKeyboardPan: boolean;
    enableMousePan: boolean;
    invertPanX: boolean;
    invertPanY: boolean;
    panKeys: {
        up: KeyCodeType[];
        down: KeyCodeType[];
        left: KeyCodeType[];
        right: KeyCodeType[];
        reset: KeyCodeType[];
    };
    smoothPanning: boolean;
    smoothingFactor: number;
    panBounds: {
        minX?: number;
        maxX?: number;
        minY?: number;
        maxY?: number;
    };
}

/**
 * Controls exposed by the panning plugin
 */
export interface IPanningControls {
    setConfig(config: Partial<IPanningConfig>): void;
    getConfig(): Readonly<IPanningConfig>;
    setMousePanEnabled(enabled: boolean): void;
    setKeyboardPanEnabled(enabled: boolean): void;
    setPanBounds(bounds: IPanningConfig['panBounds']): void;
    getPanBounds(): Readonly<IPanningConfig['panBounds']>;
    resetPanPosition(): void;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: IPanningConfig = {
    keyboardPanSpeed: 15,
    panCursor: 'grabbing',
    defaultCursor: '',
    panMouseButton: MouseButton.RIGHT,
    enableKeyboardPan: true,
    enableMousePan: true,
    invertPanX: false,
    invertPanY: false,
    panKeys: {
        up: [KeyCode.ARROW_UP, KeyCode.KEY_W],
        down: [KeyCode.ARROW_DOWN, KeyCode.KEY_S],
        left: [KeyCode.ARROW_LEFT, KeyCode.KEY_A],
        right: [KeyCode.ARROW_RIGHT, KeyCode.KEY_D],
        reset: [KeyCode.HOME, KeyCode.ESCAPE, KeyCode.KEY_R]
    },
    smoothPanning: true,
    smoothingFactor: 0.15,
    panBounds: {}
};

/**
 * Plugin that adds panning functionality to the canvas
 */
export class PanningPlugin extends CanvasPluginBase implements IPluginWithControls<IPanningControls> {
    readonly name = "PanningPlugin";
    
    private config: IPanningConfig;
    private panState: PanState;
    private animationLoop: AnimationLoop;
    private eventHandlers: EventHandlers;
    
    constructor(initialConfig?: Partial<IPanningConfig>) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...initialConfig };
        this.eventHandlers = new EventHandlers(this);
        this.panState = new PanState();
        this.animationLoop = new AnimationLoop(() => this.updateKeyboardPanning());
    }
    
    protected onInitialize(): void {
        this.eventHandlers.registerAll();
    }
    
    protected onDestroy(): void {
        this.animationLoop.stop();
        this.eventHandlers.unregisterAll();
    }
    
    protected onEnable(): void {
        if (this.config.enableKeyboardPan) {
            this.animationLoop.start();
        }
        this.canvasManagerCore.updateCursor(this.config.defaultCursor);
    }
    
    protected onDisable(): void {
        this.animationLoop.stop();
        this.panState.reset();
        this.canvasManagerCore.updateCursor('');
    }
    
    getControls(): IPanningControls {
        return new PanningControls(this);
    }
    
    /**
     * Internal method to update configuration
     */
    updateConfig(newConfig: Partial<IPanningConfig>): void {
        const oldEnableKeyboard = this.config.enableKeyboardPan;
        
        this.config = {
            ...this.config,
            ...newConfig,
            panKeys: {
                ...this.config.panKeys,
                ...(newConfig.panKeys || {})
            },
            panBounds: {
                ...this.config.panBounds,
                ...(newConfig.panBounds || {})
            }
        };
        
        if (this.isEnabled() && this.config.enableKeyboardPan !== oldEnableKeyboard) {
            if (this.config.enableKeyboardPan) {
                this.animationLoop.start();
            } else {
                this.animationLoop.stop();
                this.panState.resetVelocity();
            }
        }
        
        if (this.canvasManagerCore) {
            this.canvasManagerCore.updateCursor(this.config.defaultCursor);
        }
    }
    
    getConfiguration(): Readonly<IPanningConfig> {
        return { ...this.config };
    }
    
    /**
     * Handle mouse down events
     */
    handleMouseDown(event: MouseEvent, screenPoint: TPoint, worldPoint: TPoint): boolean {
        if (!this.config.enableMousePan || event.button !== this.config.panMouseButton) {
            return false;
        }
        
        this.panState.startMousePan(screenPoint);
        this.canvasManagerCore.updateCursor(this.config.panCursor);
        return true;
    }
    
    /**
     * Handle mouse move events
     */
    handleMouseMove(event: MouseEvent, screenPoint: TPoint): boolean {
        if (!this.config.enableMousePan || !this.panState.isMousePanning()) {
            return false;
        }
        
        const delta = this.panState.getMouseDelta(screenPoint);
        if (delta) {
            this.applyPan({
                x: this.config.invertPanX ? -delta.x : delta.x,
                y: this.config.invertPanY ? -delta.y : delta.y
            });
            this.panState.updateMousePosition(screenPoint);
        }
        
        return true;
    }
    
    /**
     * Handle mouse up events
     */
    handleMouseUp(event: MouseEvent, screenPoint: TPoint, worldPoint: TPoint): boolean {
        if (!this.panState.isMousePanning()) {
            return false;
        }
        
        this.panState.endMousePan();
        this.canvasManagerCore.updateCursor(this.config.defaultCursor);
        return true;
    }
    
    /**
     * Handle key down events
     */
    handleKeyDown(event: KeyboardEvent): boolean {
        const key = event.code;
        if (!isValidKeyCode(key)) {
            return false;
        }
        
        this.panState.addPressedKey(key);
        
        if (this.config.panKeys.reset.includes(key)) {
            this.canvasManagerCore.canvasWorld.resetViewPosition();
            this.panState.resetVelocity();
            event.preventDefault();
            return true;
        }

        const isPanKey = this.isPanKey(key);
        if (isPanKey) {
            event.preventDefault();
        }
        
        return false;
    }
    
    /**
     * Handle key up events
     */
    handleKeyUp(event: KeyboardEvent): boolean {
        const key = event.code;
        if (isValidKeyCode(key)) {
            this.panState.removePressedKey(key);
        }
        return false;
    }
    
    private isPanKey(key: KeyCodeType): boolean {
        return this.config.panKeys.up.includes(key) ||
               this.config.panKeys.down.includes(key) ||
               this.config.panKeys.left.includes(key) ||
               this.config.panKeys.right.includes(key);
    }
    
    private updateKeyboardPanning(): void {
        if (!this.config.enableKeyboardPan || !this.canvasManagerCore) {
            return;
        }
        
        const movement = this.calculateKeyboardMovement();
        
        if (this.config.smoothPanning) {
            this.panState.updateVelocity(movement, this.config.smoothingFactor);
            const velocity = this.panState.getVelocity();
            
            if (Math.abs(velocity.x) < 0.1 && Math.abs(velocity.y) < 0.1) {
                return;
            }
            
            this.applyPan({ x: -velocity.x, y: -velocity.y });
        } else {
            if (movement.x === 0 && movement.y === 0) {
                return;
            }
            
            this.applyPan({ x: -movement.x, y: -movement.y });
        }
    }
    
    private calculateKeyboardMovement(): TPoint {
        let dx = 0;
        let dy = 0;
        const speed = this.config.keyboardPanSpeed;
        
        for (const key of this.panState.getPressedKeys()) {
            if (this.config.panKeys.up.includes(key)) dy -= speed;
            if (this.config.panKeys.down.includes(key)) dy += speed;
            if (this.config.panKeys.left.includes(key)) dx -= speed;
            if (this.config.panKeys.right.includes(key)) dx += speed;
        }
        
        if (this.config.invertPanX) dx = -dx;
        if (this.config.invertPanY) dy = -dy;
        
        return { x: dx, y: dy };
    }
    
    private applyPan(screenDelta: TPoint): void {
        const core = this.canvasManagerCore;
        const worldDelta = core.canvasWorld.screenDeltaToWorldDelta(screenDelta);
        
        let newViewPosition = {
            x: core.canvasWorld.viewPosition.x - worldDelta.x,
            y: core.canvasWorld.viewPosition.y - worldDelta.y
        };
        
        // Apply bounds
        const bounds = this.config.panBounds;
        if (bounds.minX !== undefined) {
            newViewPosition.x = Math.max(bounds.minX, newViewPosition.x);
        }
        if (bounds.maxX !== undefined) {
            newViewPosition.x = Math.min(bounds.maxX, newViewPosition.x);
        }
        if (bounds.minY !== undefined) {
            newViewPosition.y = Math.max(bounds.minY, newViewPosition.y);
        }
        if (bounds.maxY !== undefined) {
            newViewPosition.y = Math.min(bounds.maxY, newViewPosition.y);
        }
        
        core.canvasWorld.viewPosition = newViewPosition;
    }
}

/**
 * Manages the state of panning operations
 */
class PanState {
    private isPanning = false;
    private lastPanPoint: TPoint | null = null;
    private keysPressed = new Set<KeyCodeType>();
    private velocity: TPoint = { x: 0, y: 0 };
    
    startMousePan(point: TPoint): void {
        this.isPanning = true;
        this.lastPanPoint = { ...point };
    }
    
    endMousePan(): void {
        this.isPanning = false;
        this.lastPanPoint = null;
    }
    
    isMousePanning(): boolean {
        return this.isPanning;
    }
    
    getMouseDelta(currentPoint: TPoint): TPoint | null {
        if (!this.lastPanPoint) {
            return null;
        }
        
        return {
            x: currentPoint.x - this.lastPanPoint.x,
            y: currentPoint.y - this.lastPanPoint.y
        };
    }
    
    updateMousePosition(point: TPoint): void {
        this.lastPanPoint = { ...point };
    }
    
    addPressedKey(key: KeyCodeType): void {
        this.keysPressed.add(key);
    }
    
    removePressedKey(key: KeyCodeType): void {
        this.keysPressed.delete(key);
    }
    
    getPressedKeys(): Set<KeyCodeType> {
        return this.keysPressed;
    }
    
    updateVelocity(target: TPoint, smoothingFactor: number): void {
        this.velocity.x = this.velocity.x * (1 - smoothingFactor) + target.x * smoothingFactor;
        this.velocity.y = this.velocity.y * (1 - smoothingFactor) + target.y * smoothingFactor;
    }
    
    getVelocity(): TPoint {
        return this.velocity;
    }
    
    resetVelocity(): void {
        this.velocity = { x: 0, y: 0 };
    }
    
    reset(): void {
        this.endMousePan();
        this.keysPressed.clear();
        this.resetVelocity();
    }
}

/**
 * Manages the animation loop for smooth panning
 */
class AnimationLoop {
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
 * Manages event handler registration
 */
class EventHandlers {
    private plugin: PanningPlugin;
    private registeredKeys = new Set<KeyCodeType>();
    
    constructor(plugin: PanningPlugin) {
        this.plugin = plugin;
    }
    
    registerAll(): void {
        const eventDispatcher = this.plugin.canvasManagerCore.eventDispatcher;
        const config = this.plugin.getConfiguration();
        
        // Register mouse handlers
        eventDispatcher.registerMouseDown(
            "start panning",
            config.panMouseButton,
            (e, sp, wp) => this.plugin.handleMouseDown(e, sp, wp)
        );
        eventDispatcher.registerMouseMove(
            "panning",
            (e, sp) => this.plugin.handleMouseMove(e, sp)
        );
        eventDispatcher.registerMouseUp(
            "stop panning",
            config.panMouseButton,
            (e, sp, wp) => this.plugin.handleMouseUp(e, sp, wp)
        );
        
        // Register keyboard handlers for all pan keys
        const allKeys = this.collectAllKeys(config.panKeys);
        for (const key of allKeys) {
            eventDispatcher.registerKeyDown(
                "start panning " + key,
                key,
                e => this.plugin.handleKeyDown(e)
            );
            eventDispatcher.registerKeyUp(
                "stop panning " + key,
                key,
                e => this.plugin.handleKeyUp(e)
            );
            this.registeredKeys.add(key);
        }
    }
    
    unregisterAll(): void {
        this.registeredKeys.clear();
    }
    
    private collectAllKeys(panKeys: IPanningConfig['panKeys']): Set<KeyCodeType> {
        const keys = new Set<KeyCodeType>();
        
        panKeys.up.forEach(k => keys.add(k));
        panKeys.down.forEach(k => keys.add(k));
        panKeys.left.forEach(k => keys.add(k));
        panKeys.right.forEach(k => keys.add(k));
        panKeys.reset.forEach(k => keys.add(k));
        
        return keys;
    }
}

/**
 * Implementation of controls exposed to external code
 */
class PanningControls implements IPanningControls {
    constructor(private plugin: PanningPlugin) {}
    
    setConfig(config: Partial<IPanningConfig>): void {
        this.plugin.updateConfig(config);
    }
    
    getConfig(): Readonly<IPanningConfig> {
        return this.plugin.getConfiguration();
    }
    
    setMousePanEnabled(enabled: boolean): void {
        this.plugin.updateConfig({ enableMousePan: enabled });
    }
    
    setKeyboardPanEnabled(enabled: boolean): void {
        this.plugin.updateConfig({ enableKeyboardPan: enabled });
    }
    
    setPanBounds(bounds: IPanningConfig['panBounds']): void {
        this.plugin.updateConfig({ panBounds: bounds });
    }
    
    getPanBounds(): Readonly<IPanningConfig['panBounds']> {
        return this.plugin.getConfiguration().panBounds;
    }
    
    resetPanPosition(): void {
        this.plugin.canvasManagerCore.canvasWorld.resetViewPosition();
    }
}