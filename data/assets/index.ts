/// <reference types="vite/client" />
/**
 * Story art.
 *
 * These files used to sit in Vite's `public/` folder and were referenced by a bare URL
 * (`<img src="village/hunter.png">`). `public/` is gone — art belongs with the story
 * (REFACTOR_PLAN §3), so it now goes through the bundler and gets a hashed, cache-busted URL.
 *
 * Authoring rule: **drop a file into `data/assets/` and it is available**, keyed by its path
 * without the extension. `data/assets/hunter.png` → `'hunter'`;
 * `data/assets/village/hunter.png` → `'village/hunter'`, which a passage in the `village`
 * chapter also reaches as just `'hunter'` (see `resolveAsset`). No import to add, no registry
 * to edit.
 */

const files = import.meta.glob('./**/*.{png,jpg,jpeg,webp,gif,svg}', {
    eager: true,
    query: '?url',
    import: 'default',
}) as Record<string, string>;

/** Every asset under `data/assets/`, keyed by extension-less path relative to this folder. */
export const assets: Record<string, string> = Object.fromEntries(
    Object.entries(files).map(([path, url]) => [path.replace(/^\.\//, '').replace(/\.[^./]+$/, ''), url])
);

/**
 * Resolves a passage's `image` name to a bundled URL. Chapter-scoped art
 * (`data/assets/<chapterId>/<image>.png`) wins over shared art (`data/assets/<image>.png`).
 * Returns `undefined` when the story has no such image, so the `<img>` renders no `src`
 * instead of a 404.
 */
export const resolveAsset = (image: string | undefined, chapterId?: string): string | undefined => {
    if (!image) return undefined;
    return (chapterId ? assets[`${chapterId}/${image}`] : undefined) ?? assets[image];
};
