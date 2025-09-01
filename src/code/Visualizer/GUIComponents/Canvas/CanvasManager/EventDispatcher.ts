import { CanvasManagerCore } from "./CanvasManagerCore";
import { KeyCodeType, MouseButtonType, validateKeyCode } from "./InputConstants";


/**
 * Separate class for managing event listeners and plugin registrations.
 */
export class GuiEventDispatcher {
    private core: CanvasManagerCore;

    private mouseDownHandlers: Map<MouseButtonType, {
        description: string,
        executeEvent: (event: MouseEvent, screenPoint: TPoint, worldPoint: TPoint) => boolean
    }[]> = new Map();
    
    private mouseMoveHandlers: {
        description: string,
        executeEvent: (event: MouseEvent, screenPoint: TPoint) => boolean
    }[] = [];
    
    private mouseUpHandlers: Map<MouseButtonType, {
        description: string,
        executeEvent: (event: MouseEvent, screenPoint: TPoint, worldPoint: TPoint) => boolean
    }[]> = new Map();
    
    private wheelHandlers: {
        description: string,
        executeEvent: (event: WheelEvent, screenPoint: TPoint, worldPoint: TPoint) => boolean
    }[] = [];
    
    private keyDownHandlers: Map<KeyCodeType, {
        description: string,
        executeEvent: (event: KeyboardEvent) => boolean
    }[]> = new Map();
    
    private keyUpHandlers: Map<KeyCodeType, {
        description: string,
        executeEvent: (event: KeyboardEvent) => boolean
    }[]> = new Map();

    constructor(core: CanvasManagerCore) {
        this.core = core;
    }

    registerMouseDown(
        description: string, 
        button: MouseButtonType, 
        handler: (event: MouseEvent, screenPoint: TPoint, worldPoint: TPoint) => boolean): void {
        if (!this.mouseDownHandlers.has(button)) {
            this.mouseDownHandlers.set(button, []);
        }
        this.mouseDownHandlers.get(button)!.push({ description, executeEvent: handler });
    }

    registerMouseMove(
        description: string, 
        handler: (event: MouseEvent, screenPoint: TPoint) => boolean): void {
        this.mouseMoveHandlers.push({ description, executeEvent: handler });
    }

    registerMouseUp(
        description: string,
        button: MouseButtonType, 
        handler: (event: MouseEvent, screenPoint: TPoint, worldPoint: TPoint) => boolean): void {
        if (!this.mouseUpHandlers.has(button)) {
            this.mouseUpHandlers.set(button, []);
        }
        this.mouseUpHandlers.get(button)!.push({ description, executeEvent: handler });
    }

    registerWheel(
        description: string,
        handler: (event: WheelEvent, screenPoint: TPoint, worldPoint: TPoint) => boolean): void {
        this.wheelHandlers.push({ description, executeEvent: handler });
    }

    registerKeyDown(
        description: string,
        key: KeyCodeType,
        handler: (event: KeyboardEvent) => boolean): void {
        if (!this.keyDownHandlers.has(key)) {
            this.keyDownHandlers.set(key, []);
        }
        this.keyDownHandlers.get(key)!.push({ description, executeEvent: handler });
    }

    registerKeyUp(
        description: string,
        key: KeyCodeType,
        handler: (event: KeyboardEvent) => boolean): void {
        if (!this.keyUpHandlers.has(key)) {
            this.keyUpHandlers.set(key, []);
        }
        this.keyUpHandlers.get(key)!.push({ description, executeEvent: handler });
    }

    dispatchMouseDown(event: MouseEvent, screenPoint: TPoint, worldPoint: TPoint): boolean {
        const handlers = this.mouseDownHandlers.get(event.button as MouseButtonType);
        if (handlers) {
            for (const handler of handlers) {
                if (handler.executeEvent(event, screenPoint, worldPoint)) {
                    return true;
                }
            }
        }
        return false;
    }

    dispatchMouseMove(event: MouseEvent, screenPoint: TPoint): boolean {
        for (const handler of this.mouseMoveHandlers) {
            if (handler.executeEvent(event, screenPoint)) {
                return true;
            }
        }
        return false;
    }

    dispatchMouseUp(event: MouseEvent, screenPoint: TPoint, worldPoint: TPoint): boolean {
        const handlers = this.mouseUpHandlers.get(event.button as MouseButtonType);
        if (handlers) {
            for (const handler of handlers) {
                if (handler.executeEvent(event, screenPoint, worldPoint)) {
                    return true;
                }
            }
        }
        return false;
    }

    dispatchWheel(event: WheelEvent, screenPoint: TPoint, worldPoint: TPoint): boolean {
        for (const handler of this.wheelHandlers) {
            if (handler.executeEvent(event, screenPoint, worldPoint)) {
                return true;
            }
        }
        return false;
    }

    dispatchKeyDown(event: KeyboardEvent): boolean {
        const key = event.code;
        validateKeyCode(key);
        
        const handlers = this.keyDownHandlers.get(key);
        if (handlers) {
            for (const handler of handlers) {
                if (handler.executeEvent(event)) {
                    return true;
                }
            }
        }
        return false;
    }

    dispatchKeyUp(event: KeyboardEvent): boolean {
        const key = event.code;
        validateKeyCode(key);

        const handlers = this.keyUpHandlers.get(key);
        if (handlers) {
            for (const handler of handlers) {
                if (handler.executeEvent(event)) {
                    return true;
                }
            }
        }
        return false;
    }
}
