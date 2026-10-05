import { deepEqual } from '../../deepEqual';
import {
    isCode,
    isValueRecord,
    type TCreateEntityBody,
    type TEntityDto,
    type TEntityKind,
    type TItemSource,
    type TUpdateEntityBody,
} from '@story/visualizer-protocol';

const SERVER_FIELDS = ['version', 'file', 'line', 'exportName', 'kind', 'id'] as const;

const isServerField = (key: string) => (SERVER_FIELDS as readonly string[]).includes(key);

// same rule as the server's ID_RE; case-insensitive uniqueness because npc files are `<Id>.ts`
const ENTITY_ID_RE = /^[a-z][A-Za-z0-9_]*$/;

export type TIdProblem = 'required' | 'dash' | 'identifier' | 'exists';

export const validateEntityId = (id: string, existing: readonly string[] = []): TIdProblem | null => {
    if (id === '') return 'required';
    if (id.includes('-')) return 'dash';
    if (!ENTITY_ID_RE.test(id)) return 'identifier';
    if (existing.some((e) => e.toLowerCase() === id.toLowerCase())) return 'exists';
    return null;
};

export const idErrorMessage = (problem: TIdProblem): string => {
    switch (problem) {
        case 'required':
            return _('Required');
        case 'dash':
            return _('Ids must not contain "-" (it separates the parts of passage ids).');
        case 'identifier':
            return _('Start with a lower-case letter; then letters, digits and "_" only.');
        case 'exists':
            return _('This id is taken.');
    }
};

export const itemSourceForType = (type: string): TItemSource =>
    type === 'food' ? 'foodInfo' : type === 'tool' ? 'toolInfo' : 'itemInfo';

export type TCreateForm = {
    id: string;
    name: string;
    description: string;
    type: string;
};

export const buildCreateBody = (kind: TEntityKind, form: TCreateForm): TCreateEntityBody => {
    const id = form.id.trim();
    const name = form.name.trim() || id;
    switch (kind) {
        case 'characters': {
            const body: TCreateEntityBody<'characters'> = form.description.trim()
                ? { id, name, description: form.description }
                : { id, name };
            return body;
        }
        case 'npcs':
        case 'locations': {
            const body: TCreateEntityBody<'npcs' | 'locations'> = { id, name, description: form.description };
            return body;
        }
        case 'items': {
            const body: TCreateEntityBody<'items'> = {
                id,
                name,
                type: form.type,
                source: itemSourceForType(form.type),
            };
            return body;
        }
    }
};

export const createFields = (kind: TEntityKind) => ({
    description:
        kind === 'items' ? ('none' as const) : kind === 'characters' ? ('optional' as const) : ('required' as const),
    type: kind === 'items',
});

export type TEntityFields = Omit<TUpdateEntityBody, 'version'>;

// `null` asks the server to remove an optional field; user fields are sent merged, so per key
const removalsOf = (base: unknown, draft: unknown): Record<string, null> =>
    isValueRecord(base)
        ? Object.fromEntries(
              Object.keys(base)
                  .filter((key) => !isValueRecord(draft) || draft[key] === undefined)
                  .map((key) => [key, null])
          )
        : {};

const changedValue = (key: string, base: unknown, draft: unknown): unknown => {
    if (draft === undefined) return null;
    if (key === 'userFields' && isValueRecord(draft)) return { ...removalsOf(base, draft), ...draft };
    return draft;
};

export const diffEditable = (base: TEntityDto, draft: TEntityDto): TEntityFields => {
    const b = new Map(Object.entries(base));
    const d = new Map(Object.entries(draft));
    return Object.fromEntries(
        [...new Set([...b.keys(), ...d.keys()])]
            .filter((key) => !isServerField(key) && !deepEqual(b.get(key), d.get(key)))
            .map((key) => [key, changedValue(key, b.get(key), d.get(key))])
    );
};

export const editableOf = (entity: TEntityDto): TEntityFields =>
    Object.fromEntries(Object.entries(entity).filter(([key]) => !isServerField(key)));

export const withFields = (entity: TEntityDto, patch: Record<string, unknown>): TEntityDto => ({ ...entity, ...patch });

export const displayName = (value: unknown, fallback: string): string => {
    if (typeof value === 'string') return value || fallback;
    if (isCode(value)) {
        const m = /^_\(\s*(['"`])(.*)\1\s*\)$/.exec(value.code.trim());
        return m ? m[2] : fallback;
    }
    return fallback;
};

export const ENTITY_TYPE_NAMES = {
    characters: { entity: 'TCharacter', data: 'TCharacterData' },
    npcs: { entity: 'TNpc', data: 'TNpcData' },
    locations: { entity: 'TLocation', data: null },
    items: { entity: 'TItemInfo', data: null },
} as const satisfies Record<TEntityKind, { entity: string; data: string | null }>;

export const ITEM_FIELDS: readonly string[] = ['name', 'type'];
