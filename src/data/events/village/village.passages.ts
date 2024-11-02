import coolPassage from './thomas.passages/cool.transition';
import { TWorldState } from 'data/TWorldState';
import { TEventPassage } from 'types/TPassage';
import { introPassage } from './thomas.passages/intro';
import { forestPassage } from './thomas.passages/forest';
import { Engine } from 'code/Engine/ts/Engine';

export type TVillagePassageId = TVillageThomasPassageId;

export type TVillageThomasPassageId = 'village-thomas-intro' | 'village-thomas-forest' |
	'village-thomas-cool';

const villageEventPassages: Record<TVillagePassageId, (s: TWorldState, e: Engine) => TEventPassage<'village'>> = {
	'village-thomas-intro': introPassage,
    'village-thomas-forest': forestPassage,
	'village-thomas-cool': coolPassage,
};

export default villageEventPassages;
