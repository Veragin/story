/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** Base URL of the Visualizer client (default: this host, port 8101). */
    readonly VITE_VISUALIZER_URL?: string;
    /** Base URL of SingleEngine (default: this host, port 8100). */
    readonly VITE_ENGINE_URL?: string;
}
