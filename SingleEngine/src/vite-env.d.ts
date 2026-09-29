/// <reference types="vite/client" />

interface ImportMetaEnv {
    /** Base URL of the landing page, where a missing `?story=` goes (default: this host, port 8103). */
    readonly VITE_LANDING_URL?: string;
}
