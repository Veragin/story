import { CanvasManagerCore, ICanvasManagerCore } from "./CanvasManagerCore";

export class CanvasManagerBuilder {
    private canvas: HTMLCanvasElement;
    private plugins: Array<(core: ICanvasManagerCore) => void> = [];

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }

    addPlugin(plugin: (core: ICanvasManagerCore) => void): this {
        this.plugins.push(plugin);
        return this;
    }

    build(): CanvasManagerCore {
        const core = new CanvasManagerCore(this.canvas);
        for (const plugin of this.plugins) {
            plugin(core);
        }
        return core;
    }
}