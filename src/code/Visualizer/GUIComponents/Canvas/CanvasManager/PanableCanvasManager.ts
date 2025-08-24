import { CanvasManagerBase } from "./CanvasManagerBase";

/**
 * Configuration interface for customizing panning behavior
 */
export interface PanableCanvasConfig {
    panKeys?: {
        up?: string[];
        down?: string[];
        left?: string[];
        right?: string[];
        reset?: string[];
    };

    keyboardPanSpeed?: number; 
    panCursor?: string;
}

/**
 * Default configuration for the panable canvas manager
 */
const DEFAULT_CONFIG: Required<PanableCanvasConfig> = {
    panKeys: {
        up: ['ArrowUp', 'w', 'W'],
        down: ['ArrowDown', 's', 'S'],
        left: ['ArrowLeft', 'a', 'A'],
        right: ['ArrowRight', 'd', 'D'],
        reset: ['r', 'R', '0']
    },
    keyboardPanSpeed: 5,
    panCursor: 'grabbing',
};

/**
 * Panable canvas manager with customizable controls
 */
export class PanableCanvasManager extends CanvasManagerBase {
    private config: Required<PanableCanvasConfig>;
    private isPanning: boolean = false;
    private lastPanPoint: TPoint | null = null;
    private panningStartPoint: TPoint | null = null;

    constructor(canvas: HTMLCanvasElement, config: PanableCanvasConfig = {}) {
        super(canvas);
        this.config = { ...DEFAULT_CONFIG, ...config };

        // Add keyboard event listener for panning
        document.addEventListener('keydown', this.handleKeyDown);
    }

    protected applyViewportTransformation(ctx: CanvasRenderingContext2D): void {
        const viewPosition = this.canvasWorld.viewPosition;
        ctx.translate(-viewPosition.x, -viewPosition.y);
    }

    protected onMouseDownPre(event: MouseEvent, screenPoint: TPoint, worldPoint: TPoint): boolean {
        // Start panning on middle mouse button or right click + Ctrl
        if (event.button === 1 || (event.button === 2 && event.ctrlKey)) {
            this.startPanning(screenPoint);
            return true;
        }
        return false;
    }

    protected onMouseMovePre(event: MouseEvent, screenPoint: TPoint): boolean {
        if (this.isPanning && this.lastPanPoint) {
            this.pan(screenPoint);
            return true;
        }
        return false;
    }

    protected onMouseUpPre(event: MouseEvent, screenPoint: TPoint, worldPoint: TPoint): void {
        if (this.isPanning) {
            this.endPanning();
        }
    }

    private startPanning(point: TPoint) {
        this.isPanning = true;
        this.lastPanPoint = point;
        this.panningStartPoint = point;
        this.canvas.style.cursor = this.config.panCursor;
    }

    private pan(currentPoint: TPoint) {
        if (!this.lastPanPoint) return;

        const dx = currentPoint.x - this.lastPanPoint.x;
        const dy = currentPoint.y - this.lastPanPoint.y;

        this.canvasWorld.pan({ x: -dx, y: -dy });
        this.lastPanPoint = currentPoint;
    }

    private endPanning() {
        this.isPanning = false;
        this.lastPanPoint = null;
        this.panningStartPoint = null;
        this.canvas.style.cursor = 'default';
    }

    private handleKeyDown = (event: KeyboardEvent) => {
        const key = event.key;
        const { panKeys, keyboardPanSpeed } = this.config;

        if (panKeys.up?.includes(key)) {
            this.canvasWorld.pan({ x: 0, y: -keyboardPanSpeed });
        } else if (panKeys.down?.includes(key)) {
            this.canvasWorld.pan({ x: 0, y: keyboardPanSpeed });
        } else if (panKeys.left?.includes(key)) {
            this.canvasWorld.pan({ x: -keyboardPanSpeed, y: 0 });
        } else if (panKeys.right?.includes(key)) {
            this.canvasWorld.pan({ x: keyboardPanSpeed, y: 0 });
        } else if (panKeys.reset?.includes(key)) {
            this.canvasWorld.resetView();
        }
    };

    protected destroy(): void {
        super.destroy();
        document.removeEventListener('keydown', this.handleKeyDown);
    }
}