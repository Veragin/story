import {
    isCode,
    isValueRecord,
    type TFieldDesc,
    type TTypeDefaultContext,
    type TTypeRef,
    type TValue,
    type TValueRecord,
} from '@story/visualizer-protocol';
import { parseValueSource } from '../valueSource';

export type TObjectIssue = { path: string; message: string };

export type TObjectParse = { ok: true; value: TValueRecord } | { ok: false; error: string };

export type TObjectRules = {
    fields?: readonly TFieldDesc[];
    allowCustomFields?: boolean;
    context: TTypeDefaultContext;
};

export const parseObjectSource = (source: string): TObjectParse => {
    const parsed = parseValueSource(source);
    if (!parsed.ok) return parsed;
    return isValueRecord(parsed.value)
        ? { ok: true, value: parsed.value }
        : { ok: false, error: _('Not an object literal') };
};

const join = (path: string, key: string | number) => (path === '' ? String(key) : `${path}.${key}`);

const quoted = (value: TValue) => (typeof value === 'string' ? `'${value}'` : String(value));

// an empty list means the options are not known (yet), not that nothing is allowed
const unlisted = (options: readonly string[], value: string) => options.length > 0 && !options.includes(value);

const typeIssue = (type: TTypeRef, value: TValue, path: string, context: TTypeDefaultContext): TObjectIssue[] => {
    if (isCode(value) || type.t === 'code') return [];
    const issue = (message: string) => [{ path, message }];
    switch (type.t) {
        case 'string':
        case 'number':
        case 'boolean':
            return typeof value === type.t ? [] : issue(_('Expected a %s', type.t));
        case 'literal':
            if (typeof value !== 'string') return issue(_('Expected one of %s', type.name));
            return unlisted(context.literalValues(type.name), value)
                ? issue(_('%s is not in %s', quoted(value), type.name))
                : [];
        case 'ref':
            if (typeof value !== 'string') return issue(_('Expected a %s id', type.name));
            return unlisted(context.idsOf(type.name), value)
                ? issue(_('Unknown %s id %s', type.name, quoted(value)))
                : [];
        case 'array':
            if (!Array.isArray(value)) return issue(_('Expected an array'));
            return value.flatMap((item, i) => typeIssue(type.of, item, join(path, i), context));
        case 'object':
            if (!isValueRecord(value)) return issue(_('Expected an object'));
            return fieldIssues(value, path, { fields: type.fields, context });
        case 'function':
            return issue(_('Expected a function'));
    }
};

const fieldIssues = (
    record: TValueRecord,
    path: string,
    { fields, allowCustomFields, context }: TObjectRules
): TObjectIssue[] => {
    if (!fields) return [];
    const known = new Set(fields.map((field) => field.key));
    const missing = fields
        .filter((field) => !field.optional && !(field.key in record))
        .map((field) => ({ path: join(path, field.key), message: _('Missing required field') }));
    const unknown = allowCustomFields
        ? []
        : Object.keys(record)
              .filter((key) => !known.has(key))
              .map((key) => ({ path: join(path, key), message: _('Unknown field') }));
    const mismatched = fields
        .filter((field) => field.key in record)
        .flatMap((field) => typeIssue(field.type, record[field.key], join(path, field.key), context));
    return [...missing, ...unknown, ...mismatched];
};

const objectIssues = (record: TValueRecord, rules: TObjectRules): TObjectIssue[] => fieldIssues(record, '', rules);

export const validateObjectSource = (
    source: string,
    rules: TObjectRules
): { parse: TObjectParse; issues: TObjectIssue[] } => {
    const parse = parseObjectSource(source);
    return { parse, issues: parse.ok ? objectIssues(parse.value, rules) : [] };
};

export const issueText = ({ path, message }: TObjectIssue) => (path === '' ? message : `${path}: ${message}`);
