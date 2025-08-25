import { CanvasManagerCore } from "./CanvasManagerCore";
import { isValidKeyCode, KeyCodeType, MouseButtonType } from "./InputConstants";


/**
 * Separate class for managing event listeners and plugin registrations.
 */
export class EventDispatcher {
    private core: CanvasManagerCore;

    private mouseDownHandlers: Map<MouseButtonType, ((event: MouseEvent, screenPoint: TPoint, worldPoint: TPoint) => boolean)[]> = new Map();
    private mouseMoveHandlers: ((event: MouseEvent, screenPoint: TPoint) => boolean)[] = [];
    private mouseUpHandlers: Map<MouseButtonType, ((event: MouseEvent, screenPoint: TPoint, worldPoint: TPoint) => boolean)[]> = new Map();
    private wheelHandlers: ((event: WheelEvent, screenPoint: TPoint, worldPoint: TPoint) => boolean)[] = [];
    private keyDownHandlers: Map<KeyCodeType, ((event: KeyboardEvent) => boolean)[]> = new Map();
    private keyUpHandlers: Map<KeyCodeType, ((event: KeyboardEvent) => boolean)[]> = new Map();

    constructor(core: CanvasManagerCore) {
        this.core = core;
    }

    registerMouseDown(button: MouseButtonType, handler: (event: MouseEvent, screenPoint: TPoint, worldPoint: TPoint) => boolean): void {
        if (!this.mouseDownHandlers.has(button)) {
            this.mouseDownHandlers.set(button, []);
        }
        this.mouseDownHandlers.get(button)!.push(handler);
    }

    registerMouseMove(handler: (event: MouseEvent, screenPoint: TPoint) => boolean): void {
        this.mouseMoveHandlers.push(handler);
    }

    registerMouseUp(button: MouseButtonType, handler: (event: MouseEvent, screenPoint: TPoint, worldPoint: TPoint) => boolean): void {
        if (!this.mouseUpHandlers.has(button)) {
            this.mouseUpHandlers.set(button, []);
        }
        this.mouseUpHandlers.get(button)!.push(handler);
    }

    registerWheel(handler: (event: WheelEvent, screenPoint: TPoint, worldPoint: TPoint) => boolean): void {
        this.wheelHandlers.push(handler);
    }

    registerKeyDown(key: KeyCodeType, handler: (event: KeyboardEvent) => boolean): void {
        if (!this.keyDownHandlers.has(key)) {
            this.keyDownHandlers.set(key, []);
        }
        this.keyDownHandlers.get(key)!.push(handler);
    }

    registerKeyUp(key: KeyCodeType, handler: (event: KeyboardEvent) => boolean): void {
        if (!this.keyUpHandlers.has(key)) {
            this.keyUpHandlers.set(key, []);
        }
        this.keyUpHandlers.get(key)!.push(handler);
    }

    dispatchMouseDown(event: MouseEvent, screenPoint: TPoint, worldPoint: TPoint): boolean {
        const handlers = this.mouseDownHandlers.get(event.button as MouseButtonType);
        if (handlers) {
            for (const handler of handlers) {
                if (handler(event, screenPoint, worldPoint)) {
                    return true;
                }
            }
        }
        return false;
    }

    dispatchMouseMove(event: MouseEvent, screenPoint: TPoint): boolean {
        for (const handler of this.mouseMoveHandlers) {
            if (handler(event, screenPoint)) {
                return true;
            }
        }
        return false;
    }

    dispatchMouseUp(event: MouseEvent, screenPoint: TPoint, worldPoint: TPoint): boolean {
        const handlers = this.mouseUpHandlers.get(event.button as MouseButtonType);
        if (handlers) {
            for (const handler of handlers) {
                if (handler(event, screenPoint, worldPoint)) {
                    return true;
                }
            }
        }
        return false;
    }

    dispatchWheel(event: WheelEvent, screenPoint: TPoint, worldPoint: TPoint): boolean {
        for (const handler of this.wheelHandlers) {
            if (handler(event, screenPoint, worldPoint)) {
                return true;
            }
        }
        return false;
    }

    dispatchKeyDown(event: KeyboardEvent): boolean {
        const key = event.code;
        if (!isValidKeyCode(key)) return false;
        const handlers = this.keyDownHandlers.get(key);
        if (handlers) {
            for (const handler of handlers) {
                if (handler(event)) {
                    return true;
                }
            }
        }
        return false;
    }

    dispatchKeyUp(event: KeyboardEvent): boolean {
        const key = event.code;
        if (!isValidKeyCode(key)) return false;
        const handlers = this.keyUpHandlers.get(key);
        if (handlers) {
            for (const handler of handlers) {
                if (handler(event)) {
                    return true;
                }
            }
        }
        return false;
    }
}
