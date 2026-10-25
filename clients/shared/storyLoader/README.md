# @story/story-loader

Runs a story's TypeScript and TSX source (`data/`, `types/`) in the browser, for SinglePlayer and its standalone build.

```ts
const loader = new StoryLoader({
    source,
    files: manifest.files,
    hostModules: {
        '@story/shared': shared,
        '@story/core': core,
        react,
        'react/jsx-runtime': jsxRuntime,
    },
    hostModuleFamilies: { '@mui/icons-material': (name) => icons[name] },
});
const story = await loader.import('@story/data');
```

- `source` (`TStorySource`) fetches a story-relative file (`data/register.ts`); `files` lists every file, so resolution never probes the network.
- Each file is transpiled with sucrase (types stripped; in `.tsx` files JSX is compiled for the automatic runtime, which imports `react/jsx-runtime`), its imports found with es-module-lexer, then turned into CommonJS and run with `new Function`. CommonJS tolerates import cycles. JSX in a `.ts` file is a compile error.
- Static imports are fetched in parallel before a module runs; `import()` calls become `__storyImport()` and load on first call (per-chapter passages).
- A story may import relative files (`.ts`/`.tsx`, folder `index.ts`/`index.tsx`), `@story/data[/…]`, `@story/types[/…]` and the host modules. Host modules are the app's own instances, so `instanceof DeltaTime` works across story and engine. Anything else is an error naming the importing file.
- A host module family maps `<prefix>/<name>` to a module whose default export is what the family returns for `name` (`@mui/icons-material/Bolt`, the deep form the MUI docs use). An unknown name is an error naming the importing file.
- `_` (translations) is installed by importing `@story/shared` before any story module runs.

## Limits

Files are compiled one by one, like Vite/esbuild do:

- values inside a `namespace` / `module` block are dropped; `declare enum` / `declare const` emit nothing;
- no `import.meta`;
- `new Function` needs `unsafe-eval` under a Content Security Policy.
