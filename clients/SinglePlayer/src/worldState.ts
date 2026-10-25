import * as icons from '@mui/icons-material';
import * as material from '@mui/material';
import * as core from '@story/core';
import { createWorldState, isStoryModule, type TStoryModule } from '@story/core';
import * as shared from '@story/shared';
import { StoryLoader, type TStorySource } from '@story/story-loader';
import * as ui from '@story/ui';
import * as react from 'react';
import * as jsxRuntime from 'react/jsx-runtime';

// the app's own instances: `instanceof DeltaTime` must hold for story values, and React hooks need one React
const HOST_MODULES = {
    '@story/shared': shared,
    '@story/core': core,
    '@story/ui': ui,
    react,
    'react/jsx-runtime': jsxRuntime,
    '@mui/material': material,
    '@mui/icons-material': icons,
};

const ICONS: ReadonlyMap<string, unknown> = new Map(Object.entries(icons));

// the deep form `@mui/icons-material/Bolt` that the MUI docs use
const HOST_MODULE_FAMILIES = { '@mui/icons-material': (name: string) => ICONS.get(name) };

export const loadStory = async (source: TStorySource, files: readonly string[]): Promise<TStoryModule> => {
    const loader = new StoryLoader({
        source,
        files,
        hostModules: HOST_MODULES,
        hostModuleFamilies: HOST_MODULE_FAMILIES,
    });
    const story = await loader.import('@story/data');
    if (!isStoryModule(story)) throw new Error(_('data/index.ts must export `register` and `itemInfo`.'));
    return story;
};

export const startStory = (story: TStoryModule, storyId: string) => {
    const { s, e } = createWorldState(story, storyId);

    window.s = s;
    window.e = e;

    return { s, e };
};
