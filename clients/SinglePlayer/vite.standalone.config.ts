import { defineConfig, mergeConfig } from 'vite';
import appConfig from './vite.config';

// `index.html` + `player/` for the web export: the story files sit next to it, found through `document.baseURI`.
// No inlined script, so a host's CSP needs no `'unsafe-inline'`; `player/` stays clear of the story's `data/` and `types/`.
export default mergeConfig(
    appConfig,
    defineConfig({
        base: './',
        define: { 'import.meta.env.VITE_STANDALONE': JSON.stringify('1') },
        build: { outDir: 'dist-standalone', emptyOutDir: true, assetsDir: 'player' },
    })
);
