import { ICanvasManagerCore } from "./CanvasManagerCore";

/**
 * Base interface for all canvas plugins
 */
export interface ICanvasPlugin {
    /** Unique identifier for the plugin */
    readonly name: string;
    
    /** Initialize the plugin with the canvas core */
    initialize(core: ICanvasManagerCore): void;
    
    /** Clean up resources when plugin is removed */
    destroy(): void;
    
    /** Enable or disable the plugin */
    setEnabled(enabled: boolean): void;
    
    /** Check if plugin is currently enabled */
    isEnabled(): boolean;
}

/**
 * Interface for plugins that expose controls
 */
export interface IPluginWithControls<TControls> extends ICanvasPlugin {
    /** Get the control interface for this plugin */
    getControls(): TControls;
}