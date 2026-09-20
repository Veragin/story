import type { Engine } from 'code/Engine/ts/Engine';
import { TWorldState } from 'data/TWorldState';
import { TChapterPassage } from '@story/types';

export type TWeddingPassageId = never;

const weddingChapterPassages: Record<TWeddingPassageId, (s: TWorldState, e: Engine) => TChapterPassage<'wedding'>> = {};

export default weddingChapterPassages;
