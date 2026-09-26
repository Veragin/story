import type { TDataTypeDto } from '@story/visualizer-protocol';
import type { SourceFile } from 'ts-morph';
import type { EventBus } from '../../events/EventBus';
import { HttpError } from '../../http/HttpError';
import { findTypeAlias } from '../ast';
import type { SourceProject } from '../SourceProject';
import { assertType } from '../validate';

/** What every writer needs: the source project and the bus its transaction goes through. */
export type TWriter = { sp: SourceProject; bus: EventBus };

/** Server-owned DTO fields a PUT may echo back; they are ignored, never written. */
export const DERIVED_FIELDS = ['version', 'file', 'line', 'exportName', 'kind', 'id'];

export const asBody = (body: unknown): Record<string, unknown> => {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
        throw HttpError.badRequest('Expected a JSON object body');
    }
    return body as Record<string, unknown>;
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

/**
 * Apply `dataType` (`{ name, code }`) to the `export type <name> = …` of an entity file. The name
 * is read-only (it is referenced from `TWorldState.ts`); a missing alias is added.
 */
export const applyDataType = (sf: SourceFile, value: unknown, suffix: string, file: string) => {
    if (value === undefined) return;
    const dt = value as Partial<TDataTypeDto>;
    if (typeof dt !== 'object' || dt === null || typeof dt.code !== 'string' || typeof dt.name !== 'string') {
        throw HttpError.badRequest('Field "dataType" must be { name, code }');
    }
    const alias = findTypeAlias(sf, (n) => n.startsWith('T') && n.endsWith(suffix));
    if (alias && alias.getName() !== dt.name) {
        throw HttpError.badRequest(`dataType.name is read-only (it is "${alias.getName()}")`);
    }
    assertType(dt.code, 'dataType.code', file);
    if (!alias) {
        sf.addTypeAlias({ name: dt.name, isExported: true, type: dt.code });
    } else if (alias.getTypeNode()?.getText() !== dt.code) {
        alias.setType(dt.code);
    }
};
