import { defineConfig, mergeConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import appConfig from './vite.config';

// one self-contained `index.html` for the web export: the story files sit next to it, found through `document.baseURI`
export default mergeConfig(
    appConfig,
    defineConfig({
        base: './',
        define: { 'import.meta.env.VITE_STANDALONE': JSON.stringify('1') },
        plugins: [viteSingleFile()],
        build: { outDir: 'dist-standalone', emptyOutDir: true },
    })
);
