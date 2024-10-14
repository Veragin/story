import { TEventPassage } from 'types/TPassage';
import { introPassage } from './annie.passages/intro';
import { palacePassage } from './annie.passages/palace';
import { TWorldState } from 'data/TWorldState';
import { Engine } from 'code/Engine/ts/Engine';

export type TKingdomPassageId = TKingdomAnniePassageId | TKingdomThomasPassageId;

export type TKingdomAnniePassageId = 'kingdom-annie-intro' | 'kingdom-annie-palace';
export type TKingdomThomasPassageId = 'kingdom-thomas-visit';

const kingdomEventPassages: Record<TKingdomPassageId, (s: TWorldState, e: Engine) => TEventPassage<'kingdom'>> = {
    'kingdom-annie-intro': introPassage,
    'kingdom-annie-palace': palacePassage,
    'kingdom-thomas-visit': introPassage,
};

export default kingdomEventPassages;
