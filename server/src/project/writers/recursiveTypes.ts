import type { TFieldDesc, TStructureDto, TTypeRef } from '@story/protocol';
import { HttpError } from '../../common/HttpError';
import { syntaxDiagnostic } from '../validate';

const structNamesOf = (ref: TTypeRef): string[] => {
    switch (ref.t) {
        case 'struct':
            return [ref.name];
        case 'array':
            return structNamesOf(ref.of);
        case 'object':
            return ref.fields.flatMap((field) => structNamesOf(field.type));
        default:
            return [];
    }
};

// the path from `from` back to `name` through the story types' fields, if any
const pathTo = (name: string, from: string, structure: TStructureDto, seen: Set<string>): string[] | null => {
    if (from === name) return [from];
    if (seen.has(from)) return null;
    seen.add(from);
    const type = structure.types.find((t) => t.kind === 'type' && t.name === from);
    for (const next of (type?.fields ?? []).flatMap((field) => structNamesOf(field.type))) {
        const rest = pathTo(name, next, structure, seen);
        if (rest) return [from, ...rest];
    }
    return null;
};

/** A `type` holding itself, directly or through other types, has no finite value. */
export const assertNotRecursive = (name: string, fields: TFieldDesc[], structure: TStructureDto) => {
    fields.forEach((field, i) => {
        const seen = new Set<string>();
        for (const start of structNamesOf(field.type)) {
            const path = pathTo(name, start, structure, seen);
            if (!path) continue;
            const message = `Field "${field.key}" makes ${name} contain itself (${[`${name}.${field.key}`, ...path].join(' → ')})`;
            throw HttpError.invalid([syntaxDiagnostic('', message, `fields.${i}.type`)], message);
        }
    });
};
