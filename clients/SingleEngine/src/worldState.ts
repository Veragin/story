import { createWorldState, type TStoryModule } from '@story/core';

export type TStoryEntry = TStoryModule & { images: Record<string, string> };

// the `/@id/` URL keeps every story out of the app's static module graph
const storyEntryUrl = (storyId: string) =>
    `${import.meta.env.BASE_URL}@id/__x00__virtual:story/${encodeURIComponent(storyId)}`;

export const loadStory = async (storyId: string): Promise<TStoryEntry> => {
    const story: TStoryEntry = await import(/* @vite-ignore */ storyEntryUrl(storyId));
    return story;
};

export const startStory = (story: TStoryEntry, storyId: string) => {
    const { s, e } = createWorldState(story.register, story.itemInfo, storyId);

    window.s = s;
    window.e = e;

    void e.handleAutoStart();
    return { s, e };
};
