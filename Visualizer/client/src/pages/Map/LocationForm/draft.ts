import type { TLocationDto, TValue } from '@story/visualizer-protocol';
import { isArrayOf, isTextRecord, toMaybeCode } from '../../../components/inputs/valueSource';
import { deepEqual } from '../../../deepEqual';

export type TLocationDraft = Pick<TLocationDto, 'name' | 'description' | 'localCharacters'>;

export type TLocationPatch = Partial<TLocationDraft>;

const isLocalCharacters = isArrayOf(isTextRecord(['name', 'description']));

export const toLocationDraft = (dto: TLocationDto): TLocationDraft => ({
    name: dto.name,
    description: dto.description ?? '',
    localCharacters: dto.localCharacters ?? [],
});

// an item the inputs turned into code cannot be a TLocalCharacterDto, so the whole list becomes code
export const toLocalCharacters = (items: TValue[]): TLocationDraft['localCharacters'] =>
    toMaybeCode(items, isLocalCharacters);

export const locationPatch = (dto: TLocationDto, draft: TLocationDraft): TLocationPatch => {
    const base = toLocationDraft(dto);
    const patch: TLocationPatch = {};
    if (!deepEqual(draft.name, base.name)) patch.name = draft.name;
    if (!deepEqual(draft.description, base.description)) patch.description = draft.description;
    if (!deepEqual(draft.localCharacters, base.localCharacters)) patch.localCharacters = draft.localCharacters;
    return patch;
};

// the author's edits over `base` win; every untouched field takes the disk's value
export const rebaseDraft = (base: TLocationDto, draft: TLocationDraft, disk: TLocationDto): TLocationDraft => ({
    ...toLocationDraft(disk),
    ...locationPatch(base, draft),
});
