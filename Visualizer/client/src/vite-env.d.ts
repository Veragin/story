/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** `mock` runs the client on the in-memory api (`api/mockApi.ts`). */
    readonly VITE_VISUALIZER_API?: string;
    /** Base URL of the landing page, the story list (default: this host, port 8103). */
    readonly VITE_LANDING_URL?: string;
}
