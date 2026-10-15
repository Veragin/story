import type { TVersion } from '@story/visualizer-protocol';
import type { SourceFile } from 'ts-morph';
import type { EventBus } from '../../events/EventBus';
import { HttpError } from '../../http/HttpError';
import { findTypeAlias } from '../ast';
import type { SourceProject } from '../SourceProject';
import { assertType } from '../validate';

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

export const applyDataType = (sf: SourceFile, value: unknown, suffix: string, file: string) => {
    if (value === undefined) return;
    const name = typeof value === 'object' && value !== null && 'name' in value ? value.name : undefined;
    const code = typeof value === 'object' && value !== null && 'code' in value ? value.code : undefined;
    if (typeof code !== 'string' || typeof name !== 'string') {
        throw HttpError.badRequest('Field "dataType" must be { name, code }');
    }
    const alias = findTypeAlias(sf, (n) => n.startsWith('T') && n.endsWith(suffix));
    if (alias && alias.getName() !== name) {
        throw HttpError.badRequest(`dataType.name is read-only (it is "${alias.getName()}")`);
    }
    assertType(code, 'dataType.code', file);
    if (!alias) {
        sf.addTypeAlias({ name, isExported: true, type: code });
    } else if (alias.getTypeNode()?.getText() !== code) {
        alias.setType(code);
    }
};
