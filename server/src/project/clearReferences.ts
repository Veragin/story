import {
    structFieldsOf,
    type TChangeEvent,
    type TClearedReferenceDto,
    type TClearedReferencesDto,
    type TDeleteReferencesDto,
    type TReferenceDto,
    type TStructureDto,
    type TTypeRef,
} from '@story/protocol';
import type { ArrayLiteralExpression, Expression, ObjectLiteralExpression, PropertyAssignment } from 'ts-morph';
import type { EventBus } from '../events/EventBus';
import { version } from '../events/version';
import { HttpError } from '../common/HttpError';
import { asArray, asObject, getProp, lineOf, quote, stringLiteral } from './ast';
import { chapterVersion } from './readers/chapters';
import { readStructure, readTypeNames } from './readers/structure';
import { refIdsOf } from './refIds';
import { dedupe, diagnosticsAsReferences, referenceAt } from './registry';
import type { EditSession, SourceProject } from './SourceProject';
import { referencedObjectId } from './story';
import { type THolderField, type TResource, valueHolders } from './valueHolders';
import type { TWriter } from './writers/common';

export type TDeleteTarget = { refName: string; id: string; resource: TResource };

export type TDeletePlan = TDeleteTarget & {
    // imports, chapter files: references no value clearing can remove
    codeReferences?: () => TReferenceDto[];
    remove: (s: EditSession) => void;
};

type TClear =
    | { op: 'removeProp'; prop: PropertyAssignment; path: string }
    | { op: 'removeElement'; array: ArrayLiteralExpression; element: Expression; path: string }
    | { op: 'default'; prop: PropertyAssignment; path: string }
    | { op: 'undefined'; prop: PropertyAssignment; path: string };

export type TValueReference = {
    resource: TResource;
    reference: TReferenceDto;
    clear: TClear;
    // `null`: a required value with no other id to fall back to
    change: TClearedReferenceDto['change'] | null;
};

const joinPath = (path: string, key: string) => (path ? `${path}.${key}` : key);

const refIdOf = (expr: Expression) => stringLiteral(expr) ?? referencedObjectId(expr);

type TWalk = {
    target: TDeleteTarget;
    structure: TStructureDto;
    found: { clear: TClear; value: Expression }[];
    // the story types being walked, so a hand-written recursive one stops
    within: readonly string[];
};

const visitValue = (walk: TWalk, expr: Expression, type: TTypeRef, path: string, clear: TClear) => {
    switch (type.t) {
        case 'ref':
            if (type.name === walk.target.refName && refIdOf(expr) === walk.target.id) {
                walk.found.push({ clear, value: expr });
            }
            return;
        case 'array': {
            const array = asArray(expr);
            array?.getElements().forEach((element, i) => {
                const elementPath = joinPath(path, String(i));
                visitValue(walk, element, type.of, elementPath, {
                    op: 'removeElement',
                    array,
                    element,
                    path: elementPath,
                });
            });
            return;
        }
        case 'object': {
            const obj = asObject(expr);
            if (obj) visitFields(walk, obj, type.fields, path, clear);
            return;
        }
        case 'struct': {
            const obj = asObject(expr);
            if (!obj || walk.within.includes(type.name)) return;
            const fields = structFieldsOf(walk.structure, type.name);
            visitFields({ ...walk, within: [...walk.within, type.name] }, obj, fields, path, clear);
            return;
        }
    }
};

const visitFields = (
    walk: TWalk,
    obj: ObjectLiteralExpression,
    fields: readonly THolderField[],
    path: string,
    parent: TClear | undefined
) => {
    for (const field of fields) {
        const prop = getProp(obj, field.key);
        if (!prop) continue;
        const fieldPath = joinPath(path, field.key);
        const clear: TClear = field.optional
            ? { op: 'removeProp', prop, path: fieldPath }
            : field.nullable
              ? { op: 'undefined', prop, path: fieldPath }
              : parent?.op === 'removeElement'
                ? // an inventory entry `{ id: 'axe' }` goes as a whole
                  parent
                : { op: 'default', prop, path: fieldPath };
        visitValue(walk, prop.getInitializerOrThrow(), field.type, fieldPath, clear);
    }
};

const changeOf = (clear: TClear, fallback: string | undefined): TValueReference['change'] => {
    switch (clear.op) {
        case 'removeProp':
        case 'removeElement':
            return { op: 'removed' };
        case 'undefined':
            return { op: 'set', value: null };
        case 'default':
            return fallback === undefined ? null : { op: 'set', value: fallback };
    }
};

const sameResource = (a: TResource, b: TResource) => a.kind === b.kind && a.id === b.id;

export const findValueReferences = (sp: SourceProject, target: TDeleteTarget): TValueReference[] => {
    const structure = readStructure(sp);
    const names = readTypeNames(sp);
    const fallback = refIdsOf(sp, structure)(target.refName).find((id) => id !== target.id);
    const holders = valueHolders(sp, structure, names).filter(
        (holder) => !sameResource(holder.resource, target.resource)
    );
    return holders.flatMap((holder) => {
        const walk: TWalk = { target, structure, found: [], within: [] };
        visitFields(walk, holder.obj, holder.fields, holder.path, undefined);
        return walk.found.map(({ clear, value }) => ({
            resource: holder.resource,
            reference: referenceAt(sp, value.getSourceFile(), lineOf(value)),
            clear,
            change: changeOf(clear, fallback),
        }));
    });
};

const applyClear = (clear: TClear, change: TClearedReferenceDto['change']) => {
    switch (clear.op) {
        case 'removeProp':
            clear.prop.remove();
            return;
        case 'removeElement':
            clear.array.removeElement(clear.element);
            return;
        case 'default':
        case 'undefined':
            clear.prop.setInitializer(change.op === 'set' && change.value !== null ? quote(change.value) : 'undefined');
    }
};

const clearNode = (clear: TClear): Expression | PropertyAssignment =>
    clear.op === 'removeElement' ? clear.element : clear.prop;

export const clearValueReferences = (s: EditSession, refs: TValueReference[]): TClearedReferenceDto[] => {
    const cleared: TClearedReferenceDto[] = [];
    const clears = new Map<TClear, TClearedReferenceDto['change']>();
    for (const ref of refs) {
        if (!ref.change)
            throw HttpError.referenced([ref.reference], 'A required value has no other id to fall back to');
        cleared.push({ ...ref.reference, resource: ref.resource, path: ref.clear.path, change: ref.change });
        clears.set(ref.clear, ref.change);
    }
    for (const ref of cleared) s.edit(s.sp.root.abs(ref.file));
    // last first, so an earlier node's position survives; a nested clear goes before its container
    const ordered = [...clears].sort(([a], [b]) => clearNode(b).getStart() - clearNode(a).getStart());
    for (const [clear, change] of ordered) {
        if (!clearNode(clear).wasForgotten()) applyClear(clear, change);
    }
    return cleared;
};

const stageDelete = (s: EditSession, plan: TDeletePlan, refs: TValueReference[]) => {
    const cleared = clearValueReferences(
        s,
        refs.filter((ref) => ref.change)
    );
    // an import only a cleared value used (`sublocations: [forestLocation]`) is no reference
    s.pruneImports();
    const blocking = [
        ...refs.filter((ref) => !ref.change).map((ref) => ref.reference),
        ...(plan.codeReferences?.() ?? []),
    ];
    plan.remove(s);
    return { cleared, blocking: dedupe(blocking) };
};

const resourceVersion = (sp: SourceProject, ref: TClearedReferenceDto) =>
    ref.resource.kind === 'chapter' ? chapterVersion(sp, ref.resource.id) : version(sp.text(sp.root.abs(ref.file)));

// the commit's one event is the delete; every value holder it rewrote goes stale too
const emitCleared = (bus: EventBus, sp: SourceProject, cleared: TClearedReferenceDto[]) => {
    const seen = new Set<string>();
    for (const ref of cleared) {
        const key = `${ref.resource.kind}:${ref.resource.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        bus.emit({
            ...ref.resource,
            version: resourceVersion(sp, ref),
            op: 'updated',
            ...(ref.resource.kind === 'chapter' ? { chapterId: ref.resource.id } : {}),
        });
    }
};

export const deleteClearingReferences = async (
    { sp, bus }: TWriter,
    plan: TDeletePlan,
    event: TChangeEvent,
    message: string
): Promise<TClearedReferencesDto> => {
    const refs = findValueReferences(sp, plan);
    const s = sp.session();
    const { cleared } = s.apply(() => {
        const staged = stageDelete(s, plan, refs);
        if (staged.blocking.length > 0) throw HttpError.referenced(staged.blocking, message);
        return staged;
    });
    // ids are `keyof` types, so leftover mentions in code surface as type errors
    await s.commit(bus, () => event, { asReferences: (d) => diagnosticsAsReferences(sp, d) });
    emitCleared(bus, sp, cleared);
    return { ok: true, cleared };
};

export const deleteReferences = (sp: SourceProject, plan: TDeletePlan): TDeleteReferencesDto => {
    const refs = findValueReferences(sp, plan);
    const s = sp.session();
    const { cleared, blocking } = s.apply(() => stageDelete(s, plan, refs));
    const fromCode = diagnosticsAsReferences(sp, s.check());
    return { cleared, blocking: dedupe([...blocking, ...fromCode]) };
};
