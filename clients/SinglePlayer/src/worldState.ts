import * as core from '@story/core';
import { createWorldState, isStoryModule, type TStoryModule } from '@story/core';
import * as shared from '@story/shared';
import { StoryLoader, type TStorySource } from '@story/story-loader';

// the engine's own instances: `instanceof DeltaTime` must hold for story values
const HOST_MODULES = { '@story/shared': shared, '@story/core': core };

export const loadStory = async (source: TStorySource, files: readonly string[]): Promise<TStoryModule> => {
    const story = await new StoryLoader({ source, files, hostModules: HOST_MODULES }).import('@story/data');
    if (!isStoryModule(story)) throw new Error(_('data/index.ts must export `register` and `itemInfo`.'));
    return story;
};

export const startStory = (story: TStoryModule, storyId: string) => {
    const { s, e } = createWorldState(story.register, story.itemInfo, storyId);

    window.s = s;
    window.e = e;

    return { s, e };
};
