import {
    refTarget,
    structNameError,
    type TFieldDesc,
    type TStructNameError,
    type TStructureDto,
    type TTypeRef,
} from '@story/visualizer-protocol';
import { HttpError } from '../../http/HttpError';
import { ENGINE_TYPES } from '../readers/structure';
import { assertType, syntaxDiagnostic } from '../validate';

const RESERVED_NAMES = ['TWorldState', ...ENGINE_TYPES];

const KEY_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const NAME_MESSAGES: Record<Exclude<TStructNameError, 'taken'>, string> = {
    required: 'A name is required',
    pattern: 'A name is T followed by an upper-case letter, then letters and digits (TRace)',
    id: 'A name ending in Id is reserved for id types',
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const textAt = (value: unknown, field: string): string => {
    if (typeof value !== 'string' || value === '') {
        throw HttpError.badRequest(`Field "${field}" must be a non-empty string`);
    }
    return value;
};

/** Unique across every type and literal of the story, and not an engine name. */
export const assertStructName = (name: unknown, structure: TStructureDto): string => {
    if (typeof name !== 'string') throw HttpError.badRequest('Field "name" must be a string');
    const taken = [...structure.literals, ...structure.types].map((s) => s.name);
    const error = structNameError(name, [...taken, ...RESERVED_NAMES]);
    if (error === 'taken') throw HttpError.exists(`"${name}" is already a type or literal`);
    if (error) throw HttpError.invalid([syntaxDiagnostic('', NAME_MESSAGES[error], 'name')], NAME_MESSAGES[error]);
    return name;
};

const parseTypeRef = (value: unknown, field: string): TTypeRef => {
    if (!isRecord(value)) throw HttpError.badRequest(`Field "${field}" must be a type`);
    switch (value.t) {
        case 'string':
            return { t: 'string' };
        case 'number':
            return { t: 'number' };
        case 'boolean':
            return { t: 'boolean' };
        case 'literal':
            return { t: 'literal', name: textAt(value.name, `${field}.name`) };
        case 'ref':
            return { t: 'ref', name: textAt(value.name, `${field}.name`) };
        case 'array':
            return { t: 'array', of: parseTypeRef(value.of, `${field}.of`) };
        case 'object':
            return { t: 'object', fields: parseFields(value.fields, `${field}.fields`) };
        case 'function': {
            const signature = textAt(value.signature, `${field}.signature`);
            assertType(signature, `${field}.signature`);
            return { t: 'function', signature };
        }
        case 'code': {
            const code = textAt(value.code, `${field}.code`);
            assertType(code, `${field}.code`);
            return { t: 'code', code };
        }
        default:
            throw HttpError.badRequest(`Field "${field}.t" is not a known type kind`);
    }
};

const parseField = (value: unknown, field: string): TFieldDesc => {
    if (!isRecord(value)) throw HttpError.badRequest(`Field "${field}" must be an object`);
    const key = textAt(value.key, `${field}.key`);
    if (!KEY_RE.test(key)) throw HttpError.badRequest(`Field "${field}.key": "${key}" is not an identifier`);
    if (value.optional !== undefined && typeof value.optional !== 'boolean') {
        throw HttpError.badRequest(`Field "${field}.optional" must be a boolean`);
    }
    if (value.description !== undefined && typeof value.description !== 'string') {
        throw HttpError.badRequest(`Field "${field}.description" must be a string`);
    }
    const description = value.description?.trim();
    return {
        key,
        type: parseTypeRef(value.type, `${field}.type`),
        optional: value.optional === true,
        ...(description ? { description } : {}),
    };
};

export const parseFields = (value: unknown, field = 'fields'): TFieldDesc[] => {
    if (!Array.isArray(value)) throw HttpError.badRequest(`Field "${field}" must be an array`);
    const fields = value.map((item, i) => parseField(item, `${field}.${i}`));
    const keys = fields.map((f) => f.key);
    const duplicate = keys.find((key, i) => keys.indexOf(key) !== i);
    if (duplicate !== undefined) throw HttpError.badRequest(`Field "${field}": key "${duplicate}" is declared twice`);
    return fields;
};

const refNames = (ref: TTypeRef): { literals: string[]; refs: string[] } => {
    switch (ref.t) {
        case 'literal':
            return { literals: [ref.name], refs: [] };
        case 'ref':
            return { literals: [], refs: [ref.name] };
        case 'array':
            return refNames(ref.of);
        case 'object': {
            const nested = ref.fields.map((f) => refNames(f.type));
            return { literals: nested.flatMap((n) => n.literals), refs: nested.flatMap((n) => n.refs) };
        }
        default:
            return { literals: [], refs: [] };
    }
};

/** Every literal and `ref` a field names must exist; `selfRef` is a type being created with its catalog. */
export const assertKnownNames = (fields: TFieldDesc[], structure: TStructureDto, selfRef?: string) => {
    for (const field of fields) {
        const { literals, refs } = refNames(field.type);
        const literal = literals.find((name) => !structure.literals.some((l) => l.name === name));
        if (literal) throw HttpError.badRequest(`Field "${field.key}": no literal "${literal}"`);
        const ref = refs.find((name) => name !== selfRef && refTarget(name, structure) === null);
        if (ref) throw HttpError.badRequest(`Field "${field.key}": "${ref}" has no ids to reference`);
    }
};

/** Old → new; dropped when unchanged. */
export const parseRenames = (value: unknown, field = 'renames'): [from: string, to: string][] => {
    if (value === undefined) return [];
    if (!isRecord(value)) throw HttpError.badRequest(`Field "${field}" must be an object`);
    const renames = Object.entries(value).map(([from, to]): [string, string] => [from, textAt(to, `${field}.${from}`)]);
    const changed = renames.filter(([from, to]) => from !== to);
    const targets = changed.map(([, to]) => to);
    const twice = targets.find((to, i) => targets.indexOf(to) !== i);
    if (twice !== undefined) throw HttpError.badRequest(`Field "${field}": two keys are renamed to "${twice}"`);
    return changed;
};

/** Distinct, non-empty strings; at least one. */
export const parseLiteralValues = (value: unknown, field = 'values'): string[] => {
    if (!Array.isArray(value) || value.length === 0) {
        throw HttpError.badRequest(`Field "${field}" must be a non-empty array`);
    }
    const values = value.map((item, i) => textAt(item, `${field}.${i}`));
    const twice = values.find((v, i) => values.indexOf(v) !== i);
    if (twice !== undefined) throw HttpError.badRequest(`Field "${field}": "${twice}" is listed twice`);
    return values;
};

export const parseFlag = (value: unknown, field: string): boolean => {
    if (value !== undefined && typeof value !== 'boolean')
        throw HttpError.badRequest(`Field "${field}" must be a boolean`);
    return value === true;
};
