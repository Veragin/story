import type { Engine } from '@story/core';
import type { TWorldState } from '../../TWorldState';
import { TChapterPassage } from '@story/types';

export type TWeddingPassageId = never;

const weddingChapterPassages: Record<TWeddingPassageId, (s: TWorldState, e: Engine) => TChapterPassage<'wedding'>> = {};

export default weddingChapterPassages;
