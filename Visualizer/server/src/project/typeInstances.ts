import { keysOf } from '@story/shared';
import {
    type TFieldDesc,
    type TStructTypeDto,
    type TTypeDefaultContext,
    typeDefault,
} from '@story/visualizer-protocol';
import type { ObjectLiteralExpression } from 'ts-morph';
import { asObject, getProp, getPropInit, keyText } from './ast';
import { objectEntries } from './objectCatalog';
import { ENTITY_TYPES, entitySources, itemNodes } from './readers/entities';
import { catalogObject, ITEM_INFO_TYPE } from './readers/structure';
import type { SourceProject } from './SourceProject';
import { genValue, schemaOf } from './values';

/** `openProps`: the objects may carry keys the type does not declare (items), so none is removed. */
export type TTypeInstances = { objects: ObjectLiteralExpression[]; openProps: boolean };

const entityInstances = (sp: SourceProject, typeName: string): ObjectLiteralExpression[] => {
    for (const kind of keysOf(ENTITY_TYPES)) {
        const { entity, data } = ENTITY_TYPES[kind];
        if (entity === typeName) return entitySources(sp, kind).map((src) => src.obj);
        if (data === typeName)
            return entitySources(sp, kind).flatMap((src) => asObject(getPropInit(src.obj, 'init')) ?? []);
    }
    return [];
};

/** The object literals typed by `type`: catalog entries, entity objects, or their `init` objects. */
export const typeInstances = (sp: SourceProject, type: TStructTypeDto): TTypeInstances => {
    if (type.name === ITEM_INFO_TYPE) return { objects: itemNodes(sp).map((node) => node.item), openProps: true };
    if (type.catalog) {
        return { objects: objectEntries(catalogObject(sp, type.catalog.name)).map((e) => e.value), openProps: false };
    }
    return { objects: entityInstances(sp, type.name), openProps: false };
};

/** What a type change does to each instance; keys are the new ones except in `renames` / `removed`. */
export type TInstanceChange = {
    renames: [from: string, to: string][];
    removed: string[];
    /** Fields whose present value is replaced by its default. */
    reset: TFieldDesc[];
    /** Added with their default where missing. */
    required: TFieldDesc[];
};

const valueText = (obj: ObjectLiteralExpression, field: TFieldDesc, ctx: TTypeDefaultContext): string | null => {
    const value = typeDefault(field.type, ctx);
    return value === null ? null : genValue(value, schemaOf(field.type), { sf: obj.getSourceFile(), path: field.key });
};

export const migrateInstance = (obj: ObjectLiteralExpression, change: TInstanceChange, ctx: TTypeDefaultContext) => {
    // every node first: a rename target may be a removed key
    const renamed = change.renames.flatMap(([from, to]) => {
        const prop = getProp(obj, from);
        return prop ? [{ prop, to }] : [];
    });
    const removed = change.removed.flatMap((key) => getProp(obj, key) ?? []);
    for (const prop of removed) prop.remove();
    for (const { prop, to } of renamed) prop.getNameNode().replaceWithText(keyText(to));
    for (const field of change.reset) {
        const prop = getProp(obj, field.key);
        if (!prop) continue;
        const text = valueText(obj, field, ctx);
        if (text !== null) prop.setInitializer(text);
        else if (field.optional) prop.remove();
    }
    for (const field of change.required) {
        if (getProp(obj, field.key)) continue;
        const text = valueText(obj, field, ctx);
        if (text !== null) obj.addPropertyAssignment({ name: keyText(field.key), initializer: text });
    }
};
