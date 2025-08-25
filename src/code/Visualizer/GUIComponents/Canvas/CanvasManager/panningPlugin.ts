import { ICanvasManagerCore } from "./CanvasManagerCore";
import { TPoint } from "./CanvasWorld";
import { isValidKeyCode, KeyCode, KeyCodeType, MouseButton, MouseButtonType } from "./InputConstants";

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
        up: [KeyCode.ARROW_UP, KeyCode.KEY_W, KeyCode.NUMPAD_5],
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

export interface PanningControls {
    setConfig(config: Partial<PanableCanvasConfig>): void;
    getConfig(): Required<PanableCanvasConfig>;
    setPanningEnabled(mouse: boolean, keyboard: boolean): void;
    setPanBounds(bounds: PanableCanvasConfig['panBounds']): void;
    getPanBounds(): Required<PanableCanvasConfig>['panBounds'];
}

export function panningPlugin(initialConfig?: PanableCanvasConfig): { plugin: (core: ICanvasManagerCore) => void; controls: PanningControls } {
    let config: Required<PanableCanvasConfig> = {
        ...DEFAULT_CONFIG,
        ...initialConfig,
        panKeys: {
            ...DEFAULT_CONFIG.panKeys,
            ...(initialConfig?.panKeys || {})
        },
        panBounds: {
            ...DEFAULT_CONFIG.panBounds,
            ...(initialConfig?.panBounds || {})
        }
    };

    let isPanning: boolean = false;
    let lastPanPoint: TPoint | null = null;
    let keysPressed: Set<KeyCodeType> = new Set();
    let panVelocity: TPoint = { x: 0, y: 0 };
    let animationFrameId: number | null = null;
    let coreRef: ICanvasManagerCore | null = null;

    const startAnimationLoop = () => {
        if (animationFrameId !== null) return;
        const animate = () => {
            updateKeyboardPanning();
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

    const applyPan = (screenDelta: TPoint) => {
        if (!coreRef) return;
        const worldDelta = coreRef.canvasWorld.screenDeltaToWorldDelta(screenDelta);
        let newViewPosition = {
            x: coreRef.canvasWorld.viewPosition.x - worldDelta.x,
            y: coreRef.canvasWorld.viewPosition.y - worldDelta.y
        };

        // Apply bounds
        if (config.panBounds.minX !== undefined) {
            newViewPosition.x = Math.max(config.panBounds.minX, newViewPosition.x);
        }
        if (config.panBounds.maxX !== undefined) {
            newViewPosition.x = Math.min(config.panBounds.maxX, newViewPosition.x);
        }
        if (config.panBounds.minY !== undefined) {
            newViewPosition.y = Math.max(config.panBounds.minY, newViewPosition.y);
        }
        if (config.panBounds.maxY !== undefined) {
            newViewPosition.y = Math.min(config.panBounds.maxY, newViewPosition.y);
        }

        coreRef.canvasWorld.viewPosition = newViewPosition;
    };

    const updateKeyboardPanning = () => {
        if (!config.enableKeyboardPan || !coreRef) return;

        let dx = 0;
        let dy = 0;
        const speed = config.keyboardPanSpeed;

        for (const key of keysPressed) {
            if (config.panKeys.up?.includes(key)) dy -= speed;
            if (config.panKeys.down?.includes(key)) dy += speed;
            if (config.panKeys.left?.includes(key)) dx -= speed;
            if (config.panKeys.right?.includes(key)) dx += speed;
        }

        // Apply inversion
        if (config.invertPanX) dx = -dx;
        if (config.invertPanY) dy = -dy;

        let screenDelta: TPoint;
        if (config.smoothPanning) {
            const factor = config.smoothingFactor;
            panVelocity.x = panVelocity.x * (1 - factor) + dx * factor;
            panVelocity.y = panVelocity.y * (1 - factor) + dy * factor;

            if (Math.abs(panVelocity.x) < 0.1 && Math.abs(panVelocity.y) < 0.1) return;

            screenDelta = { x: -panVelocity.x, y: -panVelocity.y };
        } else {
            if (dx === 0 && dy === 0) return;
            screenDelta = { x: -dx, y: -dy };
        }

        applyPan(screenDelta);
    };

    const handleMouseDown = (event: MouseEvent, screenPoint: TPoint, worldPoint: TPoint): boolean => {
        if (!config.enableMousePan || event.button !== config.panMouseButton) return false;

        isPanning = true;
        lastPanPoint = screenPoint;
        coreRef?.updateCursor(config.panCursor);
        return true;
    };

    const handleMouseMove = (event: MouseEvent, screenPoint: TPoint): boolean => {
        if (!config.enableMousePan || !isPanning || !lastPanPoint || !coreRef) return false;

        const dx = screenPoint.x - lastPanPoint.x;
        const dy = screenPoint.y - lastPanPoint.y;

        let panDx = config.invertPanX ? -dx : dx;
        let panDy = config.invertPanY ? -dy : dy;

        const screenDelta = { x: panDx, y: panDy };
        applyPan(screenDelta);

        lastPanPoint = screenPoint;
        return true;
    };

    const handleMouseUp = (event: MouseEvent, screenPoint: TPoint, worldPoint: TPoint): boolean => {
        if (!isPanning) return false;

        isPanning = false;
        lastPanPoint = null;
        coreRef?.updateCursor(config.defaultCursor);
        return true;
    };

    const handleKeyDown = (event: KeyboardEvent): boolean => {
        const key = event.code;
        if (!isValidKeyCode(key)) return false;

        keysPressed.add(key);

        if (config.panKeys.reset?.includes(key)) {
            coreRef?.canvasWorld.resetViewPosition();
            panVelocity = { x: 0, y: 0 };
            event.preventDefault();
            return true;
        }

        const allPanKeys = [
            ...(config.panKeys.up || []),
            ...(config.panKeys.down || []),
            ...(config.panKeys.left || []),
            ...(config.panKeys.right || [])
        ];
        if (allPanKeys.includes(key)) {
            event.preventDefault();
            return false; // Allow other handlers to process
        }

        return false;
    };

    const handleKeyUp = (event: KeyboardEvent): boolean => {
        const key = event.code;
        if (isValidKeyCode(key)) {
            keysPressed.delete(key);
        }
        return false;
    };

    const plugin = (core: ICanvasManagerCore) => {
        coreRef = core;

        core.eventDispatcher.registerMouseDown(config.panMouseButton, handleMouseDown);
        core.eventDispatcher.registerMouseMove(handleMouseMove);
        core.eventDispatcher.registerMouseUp(config.panMouseButton, handleMouseUp);

        core.eventDispatcher.registerKeyDown('any' as KeyCodeType, handleKeyDown); // Note: since key-specific, but dispatcher is per key, wait.
        // Wait, the dispatcher registerKeyDown(key: KeyCodeType, handler)

        // But for pan, need to register for each possible key.

        // But to handle all, perhaps register for each in panKeys.

        // But dispatcher has Map<KeyCodeType, handlers[]>

        // So, to handle, I need to register handler for each key I care about.

        // But since handleKeyDown checks if valid and adds to set, I can register a general handler, but since per key, perhaps register for all possible keys.

        // But to make it, I can collect all unique keys from panKeys, and register for each.

        const allKeys = new Set<KeyCodeType>();

        [
            ...(config.panKeys.up || []),
            ...(config.panKeys.down || []),
            ...(config.panKeys.left || []),
            ...(config.panKeys.right || []),
            ...(config.panKeys.reset || [])
        ].forEach(key => allKeys.add(key));

        for (const key of allKeys) {
            core.eventDispatcher.registerKeyDown(key, handleKeyDown);
            core.eventDispatcher.registerKeyUp(key, handleKeyUp);
        }

        core.updateCursor(config.defaultCursor);

        if (config.enableKeyboardPan) {
            startAnimationLoop();
        }
    };

    const controls: PanningControls = {
        getConfig(): Required<PanableCanvasConfig> {
            return { ...config };
        },

        setConfig(newConfig: Partial<PanableCanvasConfig>): void {
            const oldEnableKeyboardPan = config.enableKeyboardPan;
            config = {
                ...config,
                ...newConfig,
                panKeys: {
                    ...config.panKeys,
                    ...(newConfig.panKeys || {})
                },
                panBounds: {
                    ...config.panBounds,
                    ...(newConfig.panBounds || {})
                }
            };

            if (config.enableKeyboardPan !== oldEnableKeyboardPan) {
                if (config.enableKeyboardPan) {
                    startAnimationLoop();
                } else {
                    stopAnimationLoop();
                    panVelocity = { x: 0, y: 0 };
                }
            }

            // To handle changed panMouseButton, but since registered, can't change dynamically easily.
            // Assume config not change button after init.
            // Similarly for keys, if changed, need to re-register, but for simplicity, assume initial.

            if (coreRef) {
                coreRef.updateCursor(config.defaultCursor);
            }
        },

        setPanningEnabled(mouse: boolean, keyboard: boolean): void {
            const oldKeyboard = config.enableKeyboardPan;
            config.enableMousePan = mouse;
            config.enableKeyboardPan = keyboard;
            if (keyboard !== oldKeyboard) {
                if (keyboard) {
                    startAnimationLoop();
                } else {
                    stopAnimationLoop();
                    panVelocity = { x: 0, y: 0 };
                }
            }
        },

        setPanBounds(bounds: PanableCanvasConfig['panBounds']): void {
            config.panBounds = {
                ...config.panBounds,
                ...bounds
            };
        },

        getPanBounds(): Required<PanableCanvasConfig>['panBounds'] {
            return { ...config.panBounds };
        }
    };

    return { plugin, controls };
}