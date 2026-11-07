import path from 'node:path';
import {
    BUILT_IN_REF_TARGETS,
    RESERVED_CLASS_NAMES,
    refIdTypeName,
    refTarget,
    structNameError,
    type TFieldDesc,
    type TStructKind,
    type TStructNameError,
    type TStructTypeDto,
    type TStructureDto,
    type TTypeRef,
} from '@story/protocol';
import { HttpError } from '../../common/HttpError';
import { ENGINE_TYPES } from '../readers/structure';
import type { SourceProject } from '../SourceProject';
import { assertType, syntaxDiagnostic } from '../validate';

const RESERVED_NAMES = ['TWorldState', ...ENGINE_TYPES];

const KEY_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const NAME_MESSAGES: Record<TStructKind, Record<Exclude<TStructNameError, 'taken'>, string>> = {
    type: {
        required: 'A name is required',
        pattern: 'A name is T followed by an upper-case letter, then letters and digits (TData)',
        id: 'A name ending in Id is reserved for id types',
        reserved: 'This name is reserved',
    },
    class: {
        required: 'A name is required',
        pattern:
            'A class name is an upper-case letter, then letters and digits, not starting with T and an upper-case letter (Race)',
        id: 'A name ending in Id is reserved for id types',
        reserved: `${RESERVED_CLASS_NAMES.join(' and ')} are reserved class names`,
    },
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const textAt = (value: unknown, field: string): string => {
    if (typeof value !== 'string' || value === '') {
        throw HttpError.badRequest(`Field "${field}" must be a non-empty string`);
    }
    return value;
};

// a class's id type must not be one another referenceable type already has (`Item` vs `TItem`)
const idTypeTaken = (name: string, structure: TStructureDto) =>
    [...Object.keys(BUILT_IN_REF_TARGETS), ...structure.types.map((type) => type.name)].some(
        (other) => refIdTypeName(other) === refIdTypeName(name)
    );

/** Unique across every class, type and literal of the story, and not an engine name. */
export const assertStructName = (name: unknown, structure: TStructureDto, kind: TStructKind): string => {
    if (typeof name !== 'string') throw HttpError.badRequest('Field "name" must be a string');
    const taken = [...structure.literals, ...structure.types].map((s) => s.name);
    const error = structNameError(name, [...taken, ...RESERVED_NAMES], kind);
    if (error === 'taken') throw HttpError.exists(`"${name}" is already a class, type or literal`);
    if (error) {
        const message = NAME_MESSAGES[kind][error];
        throw HttpError.invalid([syntaxDiagnostic('', message, 'name')], message);
    }
    if (kind === 'class' && idTypeTaken(name, structure)) {
        throw HttpError.exists(`"${refIdTypeName(name)}" is already the id of another class`);
    }
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
        case 'struct':
            return { t: 'struct', name: textAt(value.name, `${field}.name`) };
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

type TNamedRefs = { literals: string[]; refs: string[]; structs: string[] };

const NO_NAMES: TNamedRefs = { literals: [], refs: [], structs: [] };

const refNames = (ref: TTypeRef): TNamedRefs => {
    switch (ref.t) {
        case 'literal':
            return { ...NO_NAMES, literals: [ref.name] };
        case 'ref':
            return { ...NO_NAMES, refs: [ref.name] };
        case 'struct':
            return { ...NO_NAMES, structs: [ref.name] };
        case 'array':
            return refNames(ref.of);
        case 'object': {
            const nested = ref.fields.map((f) => refNames(f.type));
            return {
                literals: nested.flatMap((n) => n.literals),
                refs: nested.flatMap((n) => n.refs),
                structs: nested.flatMap((n) => n.structs),
            };
        }
        default:
            return NO_NAMES;
    }
};

export type TNamesScope = { file: string; selfRef?: string };

type TNamed = { name: string; owner?: string; file: string };

// a private type or literal is not exported from its class's file
const assertVisible = (field: TFieldDesc, named: TNamed, file: string) => {
    if (named.owner === undefined || named.file === file) return;
    const message = `Field "${field.key}": "${named.name}" is private to class ${named.owner}`;
    throw HttpError.invalid([syntaxDiagnostic(file, message, `fields.${field.key}`)], message);
};

/** Every literal, `ref` and `struct` a field names must exist and be visible from `scope.file`. */
export const assertKnownNames = (fields: TFieldDesc[], structure: TStructureDto, scope: TNamesScope) => {
    for (const field of fields) {
        const { literals, refs, structs } = refNames(field.type);
        for (const name of literals) {
            const literal = structure.literals.find((l) => l.name === name);
            if (!literal) throw HttpError.badRequest(`Field "${field.key}": no literal "${name}"`);
            assertVisible(field, literal, scope.file);
        }
        const ref = refs.find((name) => name !== scope.selfRef && refTarget(name, structure) === null);
        if (ref) throw HttpError.badRequest(`Field "${field.key}": "${ref}" has no ids to reference`);
        for (const name of structs) {
            const type = structure.types.find((t) => t.kind === 'type' && t.origin === 'story' && t.name === name);
            if (!type) throw HttpError.badRequest(`Field "${field.key}": no story type "${name}"`);
            assertVisible(field, type, scope.file);
        }
    }
};

// private members live in the file of a class exported under types/
export const parseOwnerClass = (sp: SourceProject, value: unknown, structure: TStructureDto): TStructTypeDto => {
    if (typeof value !== 'string' || value === '') throw HttpError.badRequest('Field "owner" must be a class name');
    const owner = structure.types.find((type) => type.name === value);
    if (owner?.kind !== 'class') throw HttpError.notFound(`No class "${value}"`);
    const abs = sp.root.abs(owner.file);
    const exported = sp.file(abs)?.getClass(owner.name)?.isExported() === true;
    if (!exported || !abs.startsWith(sp.root.typesDir + path.sep)) {
        throw HttpError.badRequest(`${value} is not a class declared under types/, so it cannot have private members`);
    }
    return owner;
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
