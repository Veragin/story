import { refIdTypeName, type TFieldDesc, type TTypeRef } from './structure';

const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const NEEDS_NO_PARENS: ReadonlySet<TTypeRef['t']> = new Set([
    'string',
    'number',
    'boolean',
    'literal',
    'ref',
    'array',
    'object',
]);

const quote = (s: string): string => `'${JSON.stringify(s).slice(1, -1).replace(/\\"/g, '"').replace(/'/g, "\\'")}'`;

export const typeKeyText = (key: string): string => (IDENTIFIER_RE.test(key) ? key : quote(key));

export const jsDocText = (description: string): string => {
    const lines = description.replace(/\*\//g, '*\\/').split(/\r?\n/);
    if (lines.length === 1) return `/** ${lines[0]} */`;
    return ['/**', ...lines.map((line) => (line === '' ? ' *' : ` * ${line}`)), ' */'].join('\n');
};

const arrayItemText = (ref: TTypeRef): string =>
    NEEDS_NO_PARENS.has(ref.t) ? refToTypeText(ref) : `(${refToTypeText(ref)})`;

export const fieldText = (field: TFieldDesc): string => {
    const member = `${typeKeyText(field.key)}${field.optional ? '?' : ''}: ${refToTypeText(field.type)};`;
    return field.description ? `${jsDocText(field.description)}\n${member}` : member;
};

export const objectTypeText = (fields: readonly TFieldDesc[]): string => {
    if (fields.length === 0) return '{}';
    const members = fields.map(fieldText);
    return fields.some((field) => field.description)
        ? `{\n${members.join('\n')}\n}`
        : `{ ${members.join(' ').replace(/;$/, '')} }`;
};

/** How a field type is written; a `code` type keeps its original text. */
export const refToTypeText = (ref: TTypeRef): string => {
    switch (ref.t) {
        case 'string':
        case 'number':
        case 'boolean':
            return ref.t;
        case 'literal':
            return ref.name;
        case 'ref':
            return refIdTypeName(ref.name);
        case 'array':
            return `${arrayItemText(ref.of)}[]`;
        case 'object':
            return objectTypeText(ref.fields);
        case 'function':
            return ref.signature;
        case 'code':
            return ref.code;
    }
};

const refTypeNames = (ref: TTypeRef): string[] => {
    switch (ref.t) {
        case 'literal':
            return [ref.name];
        case 'ref':
            return [refIdTypeName(ref.name)];
        case 'array':
            return refTypeNames(ref.of);
        case 'object':
            return fieldTypeNames(ref.fields);
        default:
            return [];
    }
};

/** The named types (literals, `T<Name>Id`) the generated text of these fields mentions. */
export const fieldTypeNames = (fields: readonly TFieldDesc[]): string[] => [
    ...new Set(fields.flatMap((field) => refTypeNames(field.type))),
];
