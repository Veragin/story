import { isRecord } from '@story/shared';
import type { TStoryModule } from './buildWorldState';

const REGISTER_KEYS = ['characters', 'npcs', 'chapters', 'locations', 'passages'] as const;

/** A shallow check of a story entry (`data/index.ts`) loaded at run time. */
export const isStoryModule = (value: unknown): value is TStoryModule => {
    if (!isRecord(value) || !isRecord(value.itemInfo)) return false;
    const { register } = value;
    return isRecord(register) && REGISTER_KEYS.every((key) => isRecord(register[key]));
};
