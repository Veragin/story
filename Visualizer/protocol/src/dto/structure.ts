import { code, isCode } from './common';
import type { TOkDto, TSourceRef, TValue, TValueRecord, TVersioned, TVersionedBody } from './common';
import type { TEntityKind } from './entity';
import type { TDiagnosticDto, TReferenceDto } from './errors';
import type { TResourceKind } from './events';

export type TTypeRef =
    | { t: 'string' }
    | { t: 'number' }
    | { t: 'boolean' }
    /** A string-literal union (`TItemType`); the value is one of its members. */
    | { t: 'literal'; name: string }
    /** A referenceable type (`TLocation`, `TRace`); the value is an id, written as `T<Name>Id`. */
    | { t: 'ref'; name: string }
    | { t: 'array'; of: TTypeRef }
    /** An inline `{ … }`. */
    | { t: 'object'; fields: TFieldDesc[] }
    /** `signature` is the type text, e.g. `() => void`. */
    | { t: 'function'; signature: string }
    /** Any other type, kept as its verbatim text and shown read-only. */
    | { t: 'code'; code: string };

export type TFieldDesc = {
    key: string;
    type: TTypeRef;
    optional: boolean;
    /** An engine field: it cannot be edited or removed. */
    locked?: boolean;
    /** The JSDoc text, without the markers. */
    description?: string;
};

/** `global`: declared in `types/literals.ts`; `local`: declared in the file that uses it. */
export type TLiteralScope = 'global' | 'local';

/** The name is unique across the whole story, global and local alike. */
export type TLiteralDto = TVersioned &
    TSourceRef & {
        name: string;
        scope: TLiteralScope;
        values: string[];
    };

export type TTypeOrigin = 'story' | 'extendable' | 'engine';

export type TCatalogRefDto = {
    /** The plural export name, e.g. `races`. */
    name: string;
    /** E.g. `data/catalogs/races.ts`. */
    file: string;
    /** E.g. `TRaceId`. */
    idType: string;
};

export type TStructTypeDto = TVersioned &
    TSourceRef & {
        name: string;
        origin: TTypeOrigin;
        /** Empty for `engine`. */
        fields: TFieldDesc[];
        /** The read-only source of an `engine` or unparsable type. */
        code?: string;
        catalog?: TCatalogRefDto;
    };

export type TStructureDto = TVersioned & {
    literals: TLiteralDto[];
    types: TStructTypeDto[];
    /** Problems of the structure itself, e.g. a literal name declared twice (the second is ignored). */
    diagnostics?: TDiagnosticDto[];
};

export type TCreateTypeBody = {
    name: string;
    fields: TFieldDesc[];
    /** Creates `data/catalogs/<name>.ts` and `T<Name>Id`. */
    catalog?: { name: string };
};

/** 422 `invalid` when an instance still does not type-check; retry with `resetIncompatible`. */
export type TUpdateTypeBody = TVersionedBody & {
    fields: TFieldDesc[];
    /** Old key → new key, applied to every instance. */
    renames?: Record<string, string>;
    /** Replace the values of fields whose type changed with their `typeDefault`. */
    resetIncompatible?: boolean;
};

export type TUpdateTypeDto = {
    type: TStructTypeDto;
    /** Story-relative files of the instances that were rewritten. */
    touchedFiles: string[];
};

/** 409 `referenced` while the type is used; extendable and engine types are refused. */
export type TDeleteTypeBody = TVersionedBody;

export type TCreateLiteralBody = {
    name: string;
    values: string[];
    /** Declares a local literal in that file; without it, a global one in `types/literals.ts`. */
    file?: string;
};

export type TUpdateLiteralBody = TVersionedBody & {
    values: string[];
    /** Old value → new value, rewritten where the literal types a value. */
    renames?: Record<string, string>;
};

/** Appends one value; needs no version since it only adds. */
export type TAddLiteralValueBody = { value: string };

/** 409 `referenced` while the literal is used. */
export type TDeleteLiteralBody = TVersionedBody;

export type TCatalogEntryDto = TVersioned &
    TSourceRef & {
        kind: 'catalog';
        catalog: string;
        type: string;
        id: string;
        values: TValueRecord;
    };

export type TCatalogListDto = {
    catalog: string;
    entries: TCatalogEntryDto[];
};

export type TCreateCatalogEntryBody = { id: string; values: TValueRecord };

export type TUpdateCatalogEntryBody = TVersionedBody & { values: TValueRecord };

export type TDeleteCatalogEntryBody = TVersionedBody;

/** A value that pointed at a deleted instance, at its position before the delete. */
export type TClearedReferenceDto = TReferenceDto & {
    /** The resource holding the value, as its change event names it (`entity`, `characters/thomas`). */
    resource: { kind: TResourceKind; id: string };
    /** Dotted path of the changed value in that resource: `init.location`, `init.inventory.0`. */
    path: string;
    /** `removed`: the key or the array element is gone; `set`: replaced by `value` (`null`: `undefined`). */
    change: { op: 'removed' } | { op: 'set'; value: string | null };
};

/** Value references the delete cleared in the same write. */
export type TClearedReferencesDto = TOkDto & { cleared: TClearedReferenceDto[] };

/** What a delete would do: values it clears, and the references (mostly code) that refuse it. */
export type TDeleteReferencesDto = { cleared: TClearedReferenceDto[]; blocking: TReferenceDto[] };

export type TRefTarget =
    | { source: 'entities'; kind: TEntityKind }
    | { source: 'chapters' }
    | { source: 'catalog'; catalog: string };

export const BUILT_IN_REF_TARGETS = {
    TLocation: { source: 'entities', kind: 'locations' },
    TItem: { source: 'entities', kind: 'items' },
    TCharacter: { source: 'entities', kind: 'characters' },
    TNpc: { source: 'entities', kind: 'npcs' },
    TChapter: { source: 'chapters' },
} as const satisfies Record<string, TRefTarget>;

const isBuiltInRef = (name: string): name is keyof typeof BUILT_IN_REF_TARGETS => name in BUILT_IN_REF_TARGETS;

/** Where the ids of a `ref` come from; `null` for a type that cannot be referenced. */
export const refTarget = (name: string, structure: TStructureDto): TRefTarget | null => {
    if (isBuiltInRef(name)) return BUILT_IN_REF_TARGETS[name];
    const catalog = structure.types.find((type) => type.name === name)?.catalog;
    return catalog ? { source: 'catalog', catalog: catalog.name } : null;
};

/** `TRace` → `TRaceId`: how a `ref` field is written in the type. */
export const refIdTypeName = (refName: string): string => `${refName}Id`;

/** `TRaceId` → `TRace`; `null` when the name is not an id type. */
export const refNameOfIdType = (idType: string): string | null =>
    /^T[A-Z]\w*Id$/.test(idType) ? idType.slice(0, -2) : null;

export type TTypeDefaultContext = {
    literalValues: (name: string) => readonly string[];
    idsOf: (refName: string) => readonly string[];
};

export const typeDefaultContext = (
    structure: TStructureDto,
    idsOf: TTypeDefaultContext['idsOf']
): TTypeDefaultContext => ({
    literalValues: (name) => structure.literals.find((literal) => literal.name === name)?.values ?? [],
    idsOf,
});

export const typeDefault = (ref: TTypeRef, ctx: TTypeDefaultContext): TValue => {
    switch (ref.t) {
        case 'string':
            return '';
        case 'number':
            return 0;
        case 'boolean':
            return false;
        case 'literal':
            return ctx.literalValues(ref.name)[0] ?? '';
        case 'ref':
            return ctx.idsOf(ref.name)[0] ?? '';
        case 'array':
            return [];
        case 'object':
            return Object.fromEntries(
                ref.fields.filter((field) => !field.optional).map((field) => [field.key, typeDefault(field.type, ctx)])
            );
        case 'function':
            return code('() => {}');
        case 'code':
            // no value is known to fit arbitrary type text: the type check reports it
            return null;
    }
};

export const UNKNOWN_TYPE_REF: TTypeRef = { t: 'code', code: 'unknown' };

export const sameTypeRef = (a: TTypeRef, b: TTypeRef): boolean => JSON.stringify(a) === JSON.stringify(b);

const inferItemType = (items: TValue[]): TTypeRef => {
    const [first, ...rest] = items.map(inferTypeRef);
    if (!first || rest.some((type) => !sameTypeRef(type, first))) return UNKNOWN_TYPE_REF;
    return first;
};

/** The type of a value with no declared structure; code and `null` are `UNKNOWN_TYPE_REF`. */
export const inferTypeRef = (value: TValue): TTypeRef => {
    if (typeof value === 'string') return { t: 'string' };
    if (typeof value === 'number') return { t: 'number' };
    if (typeof value === 'boolean') return { t: 'boolean' };
    if (value === null || isCode(value)) return UNKNOWN_TYPE_REF;
    if (Array.isArray(value)) return { t: 'array', of: inferItemType(value) };
    return {
        t: 'object',
        fields: Object.entries(value).map(([key, item]) => ({ key, type: inferTypeRef(item), optional: false })),
    };
};

export const STRUCT_NAME_RE = /^T[A-Z][A-Za-z0-9]*$/;

export type TStructNameError = 'required' | 'pattern' | 'id' | 'taken';

/** A new type or literal name; `taken` lists every type and literal name in the story. */
export const structNameError = (name: string, taken: readonly string[]): TStructNameError | null => {
    if (name === '') return 'required';
    if (!STRUCT_NAME_RE.test(name)) return 'pattern';
    if (refNameOfIdType(name) !== null) return 'id';
    return taken.includes(name) ? 'taken' : null;
};
