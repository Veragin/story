import { Engine } from 'code/Engine/ts/Engine';
import { TWorldState } from 'data/TWorldState';
import { TEventPassage } from 'types/TPassage';

export type TWeddingPassageId = never;

const weddingEventPassages: Record<TWeddingPassageId, (s: TWorldState, e: Engine) => TEventPassage<'wedding'>> = {
	
};

export default weddingEventPassages;    
