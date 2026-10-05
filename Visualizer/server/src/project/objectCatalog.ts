import type { TValueRecord } from '@story/visualizer-protocol';
import { Node, type ObjectLiteralExpression, type PropertyAssignment } from 'ts-morph';
import { HttpError } from '../http/HttpError';
import { asObject, keyText, propertyKey } from './ast';
import { readValue, type TSchema } from './values';

export type TObjectEntry = { id: string; prop: PropertyAssignment; value: ObjectLiteralExpression };

export const objectEntries = (obj: ObjectLiteralExpression | undefined): TObjectEntry[] =>
    obj?.getProperties().flatMap((prop) => {
        if (!Node.isPropertyAssignment(prop)) return [];
        const id = propertyKey(prop);
        const value = asObject(prop.getInitializer());
        return id && value ? [{ id, prop, value }] : [];
    }) ?? [];

export const findObjectEntry = <T extends { id: string }>(entries: T[], id: string, what: string): T => {
    const found = entries.find((entry) => entry.id === id);
    if (!found) throw HttpError.notFound(`No ${what} "${id}"`);
    return found;
};

export const readEntryValues = (entry: ObjectLiteralExpression, schemaOf: (key: string) => TSchema): TValueRecord => {
    const values: TValueRecord = {};
    for (const prop of entry.getProperties()) {
        const key = propertyKey(prop);
        if (!key) continue;
        values[key] = Node.isPropertyAssignment(prop)
            ? (readValue(prop.getInitializerOrThrow(), schemaOf(key)) as TValueRecord[string])
            : { code: prop.getText() };
    }
    return values;
};

export const entryText = (parts: [key: string, text: string][]) =>
    `{ ${parts.map(([key, text]) => `${keyText(key)}: ${text}`).join(', ')} }`;

export const addObjectEntry = (obj: ObjectLiteralExpression, id: string, text: string) =>
    obj.addPropertyAssignment({ name: keyText(id), initializer: text });
