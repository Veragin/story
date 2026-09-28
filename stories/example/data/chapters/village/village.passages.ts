import coolPassage from './thomas.passages/cool.transition';
import type { TWorldState } from '../../TWorldState';
import { TChapterPassage } from '@story/types';
import { introPassage } from './thomas.passages/intro';
import { forestPassage } from './thomas.passages/forest';
import type { Engine } from '@story/core';

export type TVillagePassageId = TVillageThomasPassageId;

export type TVillageThomasPassageId = 'village-thomas-intro' | 'village-thomas-forest' | 'village-thomas-cool';

const villageChapterPassages: Record<TVillagePassageId, (s: TWorldState, e: Engine) => TChapterPassage<'village'>> = {
    'village-thomas-intro': introPassage,
    'village-thomas-forest': forestPassage,
    'village-thomas-cool': coolPassage,
};

export default villageChapterPassages;
