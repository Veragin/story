import type { TDataTypeDto } from './chapter';
import type { TMaybeCode, TSourceRef, TValue, TValueRecord, TVersioned, TVersionedBody } from './common';

export const ENTITY_KINDS = ['characters', 'npcs', 'locations', 'items'] as const;
export type TEntityKind = (typeof ENTITY_KINDS)[number];

export const isEntityKind = (value: string): value is TEntityKind =>
    (ENTITY_KINDS as readonly string[]).includes(value);

type TEntityBase<K extends TEntityKind> = TVersioned &
    TSourceRef & {
        kind: K;
        id: string;
    };

export type TInventoryEntryDto = { id: string; amount?: number } & { [key: string]: TValue };

export type TCharacterDto = TEntityBase<'characters'> & {
    name: TMaybeCode<string>;
    description?: TMaybeCode<string>;
    /** A text description of the portrait; the picture is the sibling `.png`. */
    image?: TMaybeCode<string>;
    /** Full passage id. */
    startPassageId?: TMaybeCode<string>;
    /** `TCharacterData` fields plus the character's own data; `inventory` as `TInventoryEntryDto[]`. */
    init: TMaybeCode<TValueRecord>;
    dataType?: TDataTypeDto;
};

export type TNpcDto = TEntityBase<'npcs'> & {
    name: TMaybeCode<string>;
    description: TMaybeCode<string>;
    /** A text description of the portrait; the picture is the sibling `.png`. */
    image?: TMaybeCode<string>;
    init: TMaybeCode<TValueRecord>;
    dataType?: TDataTypeDto;
};

/** Its polygon lives in `TMapDto.locations`, not here. */
export type TLocationDto = TEntityBase<'locations'> & {
    name: TMaybeCode<string>;
    description: TMaybeCode<string>;
    localCharacters: TMaybeCode<TLocalCharacterDto[]>;
    /** Location ids. */
    sublocations?: TMaybeCode<string[]>;
    mapId?: TMaybeCode<string>;
    init: TMaybeCode<TValueRecord>;
    dataType?: TDataTypeDto;
};

export type TLocalCharacterDto = {
    name: TMaybeCode<string>;
    description: TMaybeCode<string>;
};

/** The `data/items/*.ts` object holding an item; new items are placed by `type`. */
export type TItemSource = 'itemInfo' | 'foodInfo' | 'toolInfo';

/** `version` is the hash of the file that holds it. */
export type TItemDto = TEntityBase<'items'> & {
    source: TItemSource;
    name: TMaybeCode<string>;
    /** A `TItemType`. */
    type: string;
    /** Every other property. */
    props: TValueRecord;
};

export type TEntityDtoByKind = {
    characters: TCharacterDto;
    npcs: TNpcDto;
    locations: TLocationDto;
    items: TItemDto;
};

export type TEntityDto = TEntityDtoByKind[TEntityKind];

type TEntityServerFields = 'version' | 'file' | 'line' | 'exportName' | 'kind';

export type TEntityEditable<K extends TEntityKind> = Omit<TEntityDtoByKind[K], TEntityServerFields | 'id'>;

export type TCreateEntityBody<K extends TEntityKind = TEntityKind> = { id: string } & Partial<TEntityEditable<K>> &
    (K extends 'items' ? { type: string } : unknown);

/** Omitted fields are left untouched. */
export type TUpdateEntityBody<K extends TEntityKind = TEntityKind> = TVersionedBody & Partial<TEntityEditable<K>>;

/** 409 `referenced` while still referenced. */
export type TDeleteEntityBody = TVersionedBody;

export type TEntityListDto<K extends TEntityKind = TEntityKind> = {
    kind: K;
    entities: TEntityDtoByKind[K][];
};
