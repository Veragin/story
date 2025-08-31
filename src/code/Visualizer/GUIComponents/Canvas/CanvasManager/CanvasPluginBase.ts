import { ICanvasManagerCore } from "./CanvasManagerCore";
import { ICanvasPlugin } from "./ICanvasPlugin";

/**
 * Abstract base class providing common functionality for canvas plugins
 */
export abstract class CanvasPluginBase implements ICanvasPlugin {
    abstract readonly name: string;
    
    protected core: ICanvasManagerCore | null = null;
    private _enabled: boolean = true;
    
    initialize(core: ICanvasManagerCore): void {
        if (this.core) {
            throw new Error(`Plugin ${this.name} is already initialized`);
        }
        
        this.core = core;
        this.onInitialize();
        
        if (this._enabled) {
            this.onEnable();
        }
    }
    
    destroy(): void {
        if (!this.core) {
            return;
        }
        
        if (this._enabled) {
            this.onDisable();
        }
        
        this.onDestroy();
        this.core = null;
    }
    
    setEnabled(enabled: boolean): void {
        if (enabled === this._enabled) {
            return;
        }
        
        this._enabled = enabled;
        
        if (this.core) {
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
    
    protected requireCore(): ICanvasManagerCore {
        if (!this.core) {
            throw new Error(`Plugin ${this.name} is not initialized`);
        }
        return this.core;
    }
    
    /** Called when plugin is initialized */
    protected abstract onInitialize(): void;
    
    /** Called when plugin is destroyed */
    protected abstract onDestroy(): void;
    
    /** Called when plugin is enabled */
    protected abstract onEnable(): void;
    
    /** Called when plugin is disabled */
    protected abstract onDisable(): void;
}