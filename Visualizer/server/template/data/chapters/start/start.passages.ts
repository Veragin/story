import type { Engine } from '@story/core';
import type { TWorldState } from '../../TWorldState';
import { TChapterPassage } from '@story/types';
import { introPassage } from './hero.passages/intro';

export type TStartPassageId = TStartHeroPassageId;

export type TStartHeroPassageId = 'start-hero-intro';

const startChapterPassages: Record<TStartPassageId, (s: TWorldState, e: Engine) => TChapterPassage<'start'>> = {
    'start-hero-intro': introPassage,
};

export default startChapterPassages;
