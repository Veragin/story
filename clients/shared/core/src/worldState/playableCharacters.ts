import type { TCharacterId } from '@story/types';
import { keysOf } from '@story/shared';
import type { TWorldStateRegister } from './buildWorldState';

export const playableCharacters = (register: Pick<TWorldStateRegister, 'characters'>): TCharacterId[] =>
    keysOf(register.characters).filter((id) => register.characters[id].startPassageId !== undefined);
