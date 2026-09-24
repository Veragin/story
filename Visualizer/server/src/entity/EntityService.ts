import { Injectable, NotFoundException } from '@nestjs/common';
import { itemInfo, register } from '@story/data';
import { SourceFileService } from '../story/SourceFileService';
import { StructureService } from '../structure/StructureService';

/**
 * The entity model behind `GET /api/entity` (VISUALIZER_PLAN §5.3, §7 Phase 9).
 *
 * ## What an "entity kind" is
 *
 * A slice of `data/register.ts` — characters, side characters, chapters, locations, maps — plus
 * items, which live in `data/items/itemInfo.ts` rather than the register. Each kind knows three
 * things the generic editor needs: where its files are, what the exported symbol is called, and
 * which of its fields are safe to edit.
 *
 * ## Why the editable field list is explicit
 *
 * The obvious design is to reflect over the object and offer every scalar. That is wrong here
 * for a reason worth stating: an id is a scalar, and changing `location.id` through a form would
 * rename the entity everywhere *except* in `register.ts` and every file that references it —
 * producing a story that does not typecheck, from a field that looked like any other. So the
 * editable set is declared per kind, ids are never in it, and anything the list does not name is
 * returned read-only with the reason shown in the UI.
 *
 * Structural edits — adding a field, changing a type — are Phase 10's `structure` tab, which is
 * a different and much more dangerous operation.
 *
 * ## The editable set is the *declared type's* scalars, minus the exclusions
 *
 * Each kind names the type alias it is an instance of. The editable fields are that alias's
 * scalar properties (`string`, `number`, `boolean`, and unions of string literals), minus an
 * explicit exclusion list. That is what makes Phase 10's gate work: a field added to `TLocation`
 * through the structure tab shows up in this editor without anyone editing this file.
 *
 * The exclusions are per kind and are the fields whose meaning is not "a value you may type":
 * ids (see above) and anything a dedicated view owns. Reading the type also means a field the
 * author *removes* stops being offered, rather than lingering until someone updates a list here.
 */

/** A field the generic editor can render and write. */
export type TEntityField = {
    name: string;
    kind: 'string' | 'text' | 'number' | 'boolean';
    value: string | number | boolean | null;
};

export type TEntitySummary = {
    kind: string;
    id: string;
    label: string;
    file: string;
    hash: string | null;
};

export type TEntityDetail = TEntitySummary & {
    fields: TEntityField[];
    /** Fields present on the entity that the editor will not touch, and why. */
    readOnly: { name: string; reason: string }[];
};

export type TEntityKind = {
    kind: string;
    label: string;
    members: TEntitySummary[];
    /** False when this kind's files are not shaped for the generic editor. */
    editable: boolean;
};

type TKindConfig = {
    label: string;
    /** Entries, as `[id, value]`. */
    entries: () => [string, Record<string, unknown>][];
    /** Repo-relative file for an id, or `null` when the kind has no one-file-per-entity rule. */
    fileFor: (id: string) => string | null;
    /** The exported symbol in that file. */
    exportFor: (id: string) => string;
    /** The type alias instances of this kind are declared as. `null` when there is none. */
    typeName: string | null;
    /** Fields of that type the editor must not offer. Ids are always excluded besides these. */
    exclude: readonly string[];
    /** How to label a member in a list. */
    labelFor: (id: string, value: Record<string, unknown>) => string;
};

/** Long-form fields get a textarea rather than a single-line input. */
const TEXT_FIELDS = new Set(['description', 'text', 'body']);

@Injectable()
export class EntityService {
    private readonly kinds: Record<string, TKindConfig> = {
        character: {
            label: 'Characters',
            entries: () => Object.entries(register.characters) as [string, Record<string, unknown>][],
            fileFor: (id) => `data/characters/${id}.ts`,
            exportFor: (id) => capitalize(id),
            typeName: 'TCharacter',
            exclude: ['startPassageId', 'init'],
            labelFor: (id, value) => String(value.name ?? id),
        },
        sideCharacter: {
            label: 'Side characters',
            entries: () => Object.entries(register.sideCharacters) as [string, Record<string, unknown>][],
            fileFor: (id) => `data/sideCharacters/${capitalize(id)}.ts`,
            exportFor: (id) => capitalize(id),
            typeName: 'TSideCharacter',
            exclude: ['init'],
            labelFor: (id, value) => String(value.name ?? id),
        },
        chapter: {
            label: 'Chapters',
            entries: () => Object.entries(register.chapters) as [string, Record<string, unknown>][],
            fileFor: (id) => `data/chapters/${id}/${id}.chapter.ts`,
            exportFor: (id) => `${id}Chapter`,
            typeName: 'TChapter',
            exclude: ['timeRange', 'location', 'children', 'triggers', 'init', 'layout'],
            labelFor: (id, value) => String(value.title ?? id),
        },
        location: {
            label: 'Locations',
            entries: () => Object.entries(register.locations) as [string, Record<string, unknown>][],
            fileFor: (id) => `data/locations/${id}.location.ts`,
            exportFor: (id) => `${id}Location`,
            typeName: 'TLocation',
            exclude: ['mapId', 'localCharacters', 'sublocations', 'shape', 'init'],
            labelFor: (id, value) => String(value.name ?? id),
        },
        map: {
            label: 'Maps',
            entries: () => Object.entries((register as { maps?: Record<string, Record<string, unknown>> }).maps ?? {}),
            fileFor: (id) => `data/maps/${id}.map.ts`,
            exportFor: (id) => `${id}Map`,
            typeName: 'TMap',
            exclude: ['size', 'background', 'notes', 'strokes', 'maps'],
            labelFor: (id, value) => String(value.title ?? id),
        },
        item: {
            label: 'Items',
            entries: () => Object.entries(itemInfo as Record<string, Record<string, unknown>>),
            /**
             * Items are all declared in one file, so there is no per-entity file to open and no
             * per-entity export to edit. They are listed read-only rather than hidden: an author
             * looking for "everything in the story" should find them.
             */
            fileFor: () => null,
            exportFor: () => 'itemInfo',
            typeName: null,
            exclude: [],
            labelFor: (id, value) => String(value.name ?? id),
        },
    };

    constructor(
        private readonly files: SourceFileService,
        private readonly structure: StructureService
    ) {}

    /**
     * Which fields of a kind the editor may write, read from the kind's declared type.
     *
     * Falls back to "nothing" when the type cannot be read — a type alias the structure reader
     * does not understand is exactly the case where guessing an editable set would be wrong.
     */
    private async editableOf(kind: string): Promise<string[]> {
        const config = this.kinds[kind];
        if (!config?.typeName) return [];

        const type = await this.structure.get(config.typeName);
        if (!type?.editable) return [];

        return type.fields
            .filter((field) => isScalarType(field.type))
            .map((field) => field.name)
            .filter((name) => name !== 'id' && !name.endsWith('Id'))
            .filter((name) => !config.exclude.includes(name));
    }

    async list(): Promise<TEntityKind[]> {
        return await Promise.all(
            Object.entries(this.kinds).map(async ([kind, config]) => ({
                kind,
                label: config.label,
                editable: (await this.editableOf(kind)).length > 0,
                members: await Promise.all(
                    config.entries().map(async ([id, value]) => this.summarise(kind, config, id, value))
                ),
            }))
        );
    }

    async get(kind: string, id: string): Promise<TEntityDetail> {
        const config = this.kinds[kind];
        if (!config) throw new NotFoundException(`Unknown entity kind "${kind}"`);

        const entry = config.entries().find(([candidate]) => candidate === id);
        if (!entry) throw new NotFoundException(`No ${kind} "${id}"`);

        const [, value] = entry;
        const summary = await this.summarise(kind, config, id, value);
        const editable = await this.editableOf(kind);

        const fields: TEntityField[] = [];
        const readOnly: { name: string; reason: string }[] = [];

        // Iterated over the *type's* editable set first, so a field the author has just added
        // shows up even before any instance carries a value for it.
        for (const name of editable) {
            if (name in value) continue;
            fields.push({ name, kind: fieldKind(name, undefined), value: null });
        }

        for (const [name, raw] of Object.entries(value)) {
            if (editable.includes(name)) {
                fields.push({ name, kind: fieldKind(name, raw), value: raw as TEntityField['value'] });
                continue;
            }
            readOnly.push({ name, reason: reasonFor(name, raw) });
        }

        return { ...summary, fields, readOnly };
    }

    /** The write surface: which fields of which kind may be set. */
    async editableFields(kind: string): Promise<readonly string[]> {
        return await this.editableOf(kind);
    }

    fileOf(kind: string, id: string): string | null {
        return this.kinds[kind]?.fileFor(id) ?? null;
    }

    exportOf(kind: string, id: string): string {
        const config = this.kinds[kind];
        if (!config) throw new NotFoundException(`Unknown entity kind "${kind}"`);
        return config.exportFor(id);
    }

    has(kind: string, id: string): boolean {
        return this.kinds[kind]?.entries().some(([candidate]) => candidate === id) ?? false;
    }

    private async summarise(
        kind: string,
        config: TKindConfig,
        id: string,
        value: Record<string, unknown>
    ): Promise<TEntitySummary> {
        const file = config.fileFor(id);
        const exists = file !== null && (await this.files.exists(file));
        return {
            kind,
            id,
            label: config.labelFor(id, value),
            file: exists ? file : '',
            hash: exists ? await this.files.hashOf(file) : null,
        };
    }
}

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

/**
 * Whether a declared type is one the generic editor can render as an input.
 *
 * Scalars and unions of string literals — the things a text box, a number box or a switch can
 * hold. Deliberately conservative: `TPoint`, `string[]` and `Partial<Record<…>>` all fail, and
 * fall through to the read-only list with a reason.
 */
const isScalarType = (type: string): boolean => {
    const trimmed = type.trim();
    if (['string', 'number', 'boolean'].includes(trimmed)) return true;
    // A union of string literals: `'a' | 'b'`.
    return /^'[^']*'(\s*\|\s*'[^']*')*$/.test(trimmed);
};

const fieldKind = (name: string, value: unknown): TEntityField['kind'] => {
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    return TEXT_FIELDS.has(name) ? 'text' : 'string';
};

/**
 * Why a field is not editable here. Shown in the UI rather than leaving the author to guess —
 * "read-only" without a reason reads as a bug.
 */
const reasonFor = (name: string, value: unknown): string => {
    if (name === 'id' || name.endsWith('Id')) {
        return 'An id is referenced from register.ts and from every file that names it; renaming one here would leave the story unable to compile.';
    }
    if (typeof value === 'function') return 'This is a function — open the file and edit it directly.';
    if (Array.isArray(value))
        return 'Lists are edited in the view that owns them (the map, the timeline, the chapter graph).';
    if (value && typeof value === 'object') return 'Nested objects are edited in the view that owns them.';
    return 'Not part of this entity kind’s editable set.';
};
