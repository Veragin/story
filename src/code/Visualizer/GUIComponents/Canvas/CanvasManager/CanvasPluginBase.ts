import { ICanvasManagerCore } from "./CanvasManagerCore";
import { ICanvasPlugin } from "./ICanvasPlugin";

/**
 * Abstract base class providing common functionality for canvas plugins
 */
export abstract class CanvasPluginBase implements ICanvasPlugin {
    abstract readonly name: string;
    
    private _canvasManagerCore: ICanvasManagerCore | null = null;
    private _enabled: boolean = true;
    
    initialize(canvasManagerCore: ICanvasManagerCore): void {
        if (this._canvasManagerCore) {
            throw new Error(`Plugin ${this.name} is already initialized`);
        }

        this._canvasManagerCore = canvasManagerCore;
        this.onInitialize();
        
        if (this._enabled) {
            this.onEnable();
        }
    }
    
    destroy(): void {
        if (!this._canvasManagerCore) {
            return;
        }
        
        if (this._enabled) {
            this.onDisable();
        }
        
        this.onDestroy();
        this._canvasManagerCore = null;
    }
    
    setEnabled(enabled: boolean): void {
        if (enabled === this._enabled) {
            return;
        }
        
        this._enabled = enabled;
        
        if (this.canvasManagerCore) {
            if (enabled) {
                this.onEnable();
            } else {
                this.onDisable();
            }
        }
    }
    
    isEnabled(): boolean {
        return this._enabled;
    }
    
    public get canvasManagerCore(): ICanvasManagerCore {
        if (!this._canvasManagerCore) {
            throw new Error(`Plugin ${this.name} is not initialized`);
        }
        return this._canvasManagerCore;
    }
    
    protected abstract onInitialize(): void;
    protected abstract onDestroy(): void;
    protected abstract onEnable(): void;
    protected abstract onDisable(): void;
}