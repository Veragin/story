import type { TDataTypeDto } from './chapter';
import type { TMaybeCode, TSourceRef, TValue, TValueRecord, TVersioned, TVersionedBody } from './common';

/** The entity kinds of the Entities page and of `/entities/:kind` (plan §3). */
export const ENTITY_KINDS = ['characters', 'npcs', 'locations', 'items'] as const;
export type TEntityKind = (typeof ENTITY_KINDS)[number];

export const isEntityKind = (value: string): value is TEntityKind =>
    (ENTITY_KINDS as readonly string[]).includes(value);

type TEntityBase<K extends TEntityKind> = TVersioned &
    TSourceRef & {
        kind: K;
        id: string;
    };

/** An inventory entry in an `init` (`TItemPartial`): `{ id: 'bow', amount: 1 }`. */
export type TInventoryEntryDto = { id: string; amount?: number } & { [key: string]: TValue };

/**
 * A playable character — `data/characters/<name>.ts`, `TCharacter<Ch>` (`types/TCharacter.ts`),
 * registered in `register.characters` and `TWorldState.characters`.
 */
export type TCharacterDto = TEntityBase<'characters'> & {
    name: TMaybeCode<string>;
    description?: TMaybeCode<string>;
    /** A text description of the portrait; the picture is the file's sibling `.png` (`dto/image.ts`). */
    image?: TMaybeCode<string>;
    /** Full passage id. */
    startPassageId?: TMaybeCode<string>;
    /**
     * `init`: `TCharacterData` fields (`health`, `location`) plus the
     * character's own data, and `inventory` as `TInventoryEntryDto[]`.
     */
    init: TMaybeCode<TValueRecord>;
    /** `export type T<Name>CharacterData = { … }` */
    dataType?: TDataTypeDto;
};

/** A non-playable character — `data/npcs/<Name>.ts`, `TNpc<Ch>`. */
export type TNpcDto = TEntityBase<'npcs'> & {
    name: TMaybeCode<string>;
    description: TMaybeCode<string>;
    /** A text description of the portrait; the picture is the file's sibling `.png` (`dto/image.ts`). */
    image?: TMaybeCode<string>;
    /** `init`: `location`, `isDead`, `inventory` and the npc's own data. */
    init: TMaybeCode<TValueRecord>;
    /** `export type T<Name>NpcData = { … }` */
    dataType?: TDataTypeDto;
};

/**
 * A location — `data/locations/<id>.location.ts`, `TLocation<L>`. Its polygon is *not* here:
 * geometry lives in `map.json` (`TMapDto.locations`, plan §1).
 */
export type TLocationDto = TEntityBase<'locations'> & {
    name: TMaybeCode<string>;
    description: TMaybeCode<string>;
    localCharacters: TMaybeCode<TLocalCharacterDto[]>;
    /** `sublocations?: TLocation[]`, as referenced location ids. */
    sublocations?: TMaybeCode<string[]>;
    mapId?: TMaybeCode<string>;
    init: TMaybeCode<TValueRecord>;
    /** `export type T<Name>LocationData = { … }` */
    dataType?: TDataTypeDto;
};

export type TLocalCharacterDto = {
    name: TMaybeCode<string>;
    description: TMaybeCode<string>;
};

/** Which `data/items/*.ts` object holds an item; new items are placed by `type` (plan WP7). */
export type TItemSource = 'itemInfo' | 'foodInfo' | 'toolInfo';

/**
 * An item — one property of `itemInfo` (`data/items/itemInfo.ts`) or of an object spread into it
 * (`foodInfo`, `toolInfo`). `version` is the hash of the file that holds it.
 */
export type TItemDto = TEntityBase<'items'> & {
    source: TItemSource;
    name: TMaybeCode<string>;
    /** A `TItemType` (`'value' | 'resource' | 'tool' | 'food' | 'weapon'`). */
    type: string;
    /** Every other property (`hungerValue`, `damage`, `dmg`, …), as free-form values. */
    props: TValueRecord;
};

export type TEntityDtoByKind = {
    characters: TCharacterDto;
    npcs: TNpcDto;
    locations: TLocationDto;
    items: TItemDto;
};

export type TEntityDto = TEntityDtoByKind[TEntityKind];

/** Fields the server derives or owns — never sent by the client. */
type TEntityServerFields = 'version' | 'file' | 'line' | 'exportName' | 'kind';

/** Editable fields of an entity of kind `K` (id is read-only once created). */
export type TEntityEditable<K extends TEntityKind> = Omit<TEntityDtoByKind[K], TEntityServerFields | 'id'>;

/** `POST /entities/:kind` */
export type TCreateEntityBody<K extends TEntityKind = TEntityKind> = { id: string } & Partial<TEntityEditable<K>> &
    (K extends 'items' ? { type: string } : unknown);

/** `PUT /entities/:kind/:id` — omitted fields are left untouched. */
export type TUpdateEntityBody<K extends TEntityKind = TEntityKind> = TVersionedBody & Partial<TEntityEditable<K>>;

/** `DELETE /entities/:kind/:id` — refused with 409 `referenced` while still referenced. */
export type TDeleteEntityBody = TVersionedBody;

/** `GET /entities/:kind` */
export type TEntityListDto<K extends TEntityKind = TEntityKind> = {
    kind: K;
    entities: TEntityDtoByKind[K][];
};
