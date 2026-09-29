import { createWorldState, type TStoryModule } from '@story/core';

/**
 * What a story's virtual module (`virtual:story/<id>`, `vite/storiesPlugin.ts`) exports: the story
 * the engine runs, plus the URL of every image under its `data/` (path relative to `data/` → URL,
 * see `images.ts`). Typed as the engine's `TStoryModule`, i.e. shaped like the example's
 * `@story/data` (the one story this app type-checks against); the actual story is whatever
 * `?story=` names, type-checked on its own by `yarn typecheck` (`scripts/typecheck-stories.mjs`).
 */
export type TStoryEntry = TStoryModule & { images: Record<string, string> };

/**
 * The dev-server URL of a story's virtual module. The app imports the story by URL, never by
 * specifier, so no story is in its static module graph; this is the `/@id/` form Vite itself gives
 * a virtual module. It is guarded like every story file: 403 unless this browser may play it.
 */
const storyEntryUrl = (storyId: string) =>
    `${import.meta.env.BASE_URL}@id/__x00__virtual:story/${encodeURIComponent(storyId)}`;

/** Loads the story `storyId` (its passages still code-split per chapter, `data/register.ts`). */
export const loadStory = (storyId: string): Promise<TStoryEntry> =>
    import(/* @vite-ignore */ storyEntryUrl(storyId)) as Promise<TStoryEntry>;

/**
 * The SingleEngine app's world state instance for `story`. Other apps build their own. The story
 * id namespaces the localStorage save.
 */
export const startStory = (story: TStoryEntry, storyId: string) => {
    const { s, e } = createWorldState(story.register, story.itemInfo, storyId);

    window.s = s;
    window.e = e;

    void e.handleAutoStart();
    return { s, e };
};
