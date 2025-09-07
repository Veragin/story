import { CanvasManagerCore, ICanvasManagerCore } from "./CanvasManagerCore";
import { ICanvasPlugin, IPluginWithControls } from "../Plugins/ICanvasPlugin";

/**
 * Result of building a canvas manager with plugins
 */
export interface ICanvasManagerBuildResult {
    core: CanvasManagerCore;
    plugins: Map<string, ICanvasPlugin>;
    getPlugin<T extends ICanvasPlugin>(name: string): T | undefined;
    getPluginControls<TControls>(name: string): TControls | undefined;
    destroy(): void;
}

/**
 * Builder for creating canvas managers with plugins
 */
export class CanvasManagerBuilder {
    private canvas: HTMLCanvasElement;
    private plugins: Map<string, ICanvasPlugin> = new Map();
    
    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }
    
    /**
     * Add a plugin to the canvas manager
     */
    addPlugin(plugin: ICanvasPlugin): this {
        if (this.plugins.has(plugin.name)) {
            throw new Error(`Plugin with name '${plugin.name}' already exists`);
        }
        
        this.plugins.set(plugin.name, plugin);
        return this;
    }
    
    /**
     * Build the canvas manager with all configured plugins
     */
    build(): ICanvasManagerBuildResult {
        const core = new CanvasManagerCore(this.canvas);
        
        for (const plugin of this.plugins.values()) {
            plugin.initialize(core);
        }
        
        return new CanvasManagerBuildResult(core, this.plugins);
    }
}

/**
 * Implementation of the build result
 */
class CanvasManagerBuildResult implements ICanvasManagerBuildResult {
    constructor(
        public readonly core: CanvasManagerCore,
        public readonly plugins: Map<string, ICanvasPlugin>
    ) {}
    
    getPlugin<T extends ICanvasPlugin>(name: string): T | undefined {
        return this.plugins.get(name) as T | undefined;
    }
    
    getPluginControls<TControls>(name: string): TControls | undefined {
        const plugin = this.plugins.get(name);
        
        if (!plugin) {
            return undefined;
        }
        
        // Check if plugin has controls
        if (this.hasControls(plugin)) {
            return plugin.getControls() as TControls;
        }
        
        return undefined;
    }
    
    private hasControls(plugin: ICanvasPlugin): plugin is IPluginWithControls<any> {
        return 'getControls' in plugin && typeof (plugin as any).getControls === 'function';
    }
    
    /**
     * Destroy all plugins and the core
     */
    destroy(): void {
        // Destroy plugins in reverse order
        const pluginArray = Array.from(this.plugins.values());
        for (let i = pluginArray.length - 1; i >= 0; i--) {
            try {
                pluginArray[i].destroy();
            } catch (error) {
                console.error(`Error destroying plugin '${pluginArray[i].name}':`, error);
            }
        }
        
        // Dispose core
        this.core.destroy();
    }
}