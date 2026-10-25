import type { TWorldState } from '@story/data';
import { buildWorldState, type TStoryModule } from './buildWorldState';
import { Engine } from '../engine/Engine';

/** A play session: `storyId` namespaces its localStorage save. */
export const createWorldState = (story: TStoryModule, storyId: string): { s: TWorldState; e: Engine } => {
    const s = buildWorldState(story.register, story.itemInfo);
    const e = new Engine(s, story, storyId);

    return { s, e };
};
