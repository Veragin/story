import {
    eventIds,
    fieldTypeNames,
    objectTypeText,
    sameTypeRef,
    type TChangeEvent,
    type TVersion,
} from '@story/visualizer-protocol';
import type { SourceFile, TypeAliasDeclaration } from 'ts-morph';
import type { EventBus } from '../../events/EventBus';
import { pathToResources } from '../../events/pathToEvent';
import { version } from '../../events/version';
import { HttpError } from '../../http/HttpError';
import { findTypeAlias, removeStatement } from '../ast';
import { readStructure, readTypeNames, typeLiteralFields, TYPES_INDEX_FILE } from '../readers/structure';
import type { EditSession, SourceProject } from '../SourceProject';
import { ensureTypeImports } from '../typeText';
import { assertType } from '../validate';
import { assertKnownNames, isRecord, parseFields } from './structureBody';

export type TWriter = { sp: SourceProject; bus: EventBus };

export const DERIVED_FIELDS = ['version', 'file', 'line', 'exportName', 'kind', 'id'];

export const asBody = (body: unknown): Record<string, unknown> => {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
        throw HttpError.badRequest('Expected a JSON object body');
    }
    return body as Record<string, unknown>;
};

export const assertCurrentVersion = (body: Record<string, unknown>, current: { version: TVersion }) => {
    if (body.version !== current.version) throw HttpError.stale(current);
};

export const requireText = (body: Record<string, unknown>, field: string): string => {
    const v = body[field];
    if (typeof v !== 'string' || v === '') throw HttpError.badRequest(`Field "${field}" must be a non-empty string`);
    return v;
};

export const optionalText = (body: Record<string, unknown>, field: string): string | undefined => {
    const v = body[field];
    if (v === undefined) return undefined;
    if (typeof v !== 'string') throw HttpError.badRequest(`Field "${field}" must be a string`);
    return v;
};

const DATA_TYPE_SHAPE = 'Field "dataType" must be { name, fields } or { name, code }';

const changedFields = (sp: SourceProject, value: Record<string, unknown>, alias: TypeAliasDeclaration | undefined) => {
    if (value.fields === undefined) return undefined;
    const fields = parseFields(value.fields, 'dataType.fields');
    const current = alias && typeLiteralFields(alias.getTypeNode(), readTypeNames(sp));
    const unchanged = current && sameTypeRef({ t: 'object', fields }, { t: 'object', fields: current });
    return unchanged ? undefined : fields;
};

// unchanged `fields` fall back to `code`, so a body echoing the DTO keeps the author's text
const dataTypeText = (
    sp: SourceProject,
    sf: SourceFile,
    value: Record<string, unknown>,
    alias: TypeAliasDeclaration | undefined,
    file: string
): string | undefined => {
    const fields = changedFields(sp, value, alias);
    if (fields) {
        assertKnownNames(fields, readStructure(sp));
        ensureTypeImports(sp, sf, fieldTypeNames(fields));
        return objectTypeText(fields);
    }
    if (value.code === undefined && value.fields !== undefined) return undefined;
    if (typeof value.code !== 'string') throw HttpError.badRequest(DATA_TYPE_SHAPE);
    assertType(value.code, 'dataType.code', file);
    return value.code;
};

export const applyDataType = (sp: SourceProject, sf: SourceFile, value: unknown, suffix: string, file: string) => {
    if (value === undefined) return;
    if (!isRecord(value) || typeof value.name !== 'string') throw HttpError.badRequest(DATA_TYPE_SHAPE);
    const alias = findTypeAlias(sf, (n) => n.startsWith('T') && n.endsWith(suffix));
    if (alias && alias.getName() !== value.name) {
        throw HttpError.badRequest(`dataType.name is read-only (it is "${alias.getName()}")`);
    }
    const text = dataTypeText(sp, sf, value, alias, file);
    if (text === undefined) return;
    if (!alias) {
        sf.addTypeAlias({ name: value.name, isExported: true, type: text });
    } else if (alias.getTypeNode()?.getText() !== text) {
        alias.setType(text);
    }
};

export const structureEvent = (sp: SourceProject, op: 'created' | 'updated' | 'deleted'): TChangeEvent => ({
    kind: 'structure',
    id: eventIds.structure,
    version: readStructure(sp).version,
    op,
});

// a commit emits one event; the other resources it rewrote (instances of a type) still go stale
export const emitWrittenResources = (bus: EventBus, sp: SourceProject, written: Map<string, string | null>) => {
    const seen = new Set<string>();
    for (const [abs, text] of written) {
        for (const ref of pathToResources(sp.root.rel(abs))) {
            const key = `${ref.kind}:${ref.id}`;
            if (ref.kind === 'structure' || ref.kind === 'project' || seen.has(key)) continue;
            seen.add(key);
            bus.emit({
                kind: ref.kind,
                id: ref.id,
                version: text === null ? null : version(text),
                op: text === null ? 'deleted' : 'updated',
                ...(ref.chapterId ? { chapterId: ref.chapterId } : {}),
            });
        }
    }
};

/** `types/index.ts` re-exports every type file: `module` is `./TRace`. */
export const barrelAdd = (s: EditSession, module: string) => {
    const sf = s.edit(s.sp.root.abs(TYPES_INDEX_FILE), TYPES_INDEX_FILE);
    if (sf.getExportDeclaration((d) => d.getModuleSpecifierValue() === module)) return;
    sf.addExportDeclaration({ moduleSpecifier: module });
};

export const barrelRemove = (s: EditSession, module: string) => {
    const sf = s.edit(s.sp.root.abs(TYPES_INDEX_FILE), TYPES_INDEX_FILE);
    const decl = sf.getExportDeclaration((d) => d.getModuleSpecifierValue() === module);
    if (decl) removeStatement(decl);
};
