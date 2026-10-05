import {
    refIdTypeName,
    refNameOfIdType,
    type TFieldDesc,
    type TStructureDto,
    type TTypeRef,
} from '@story/visualizer-protocol';
import { HttpError } from '../../http/HttpError';
import { syntaxDiagnostic } from '../validate';

// `TItemId` is `keyof typeof itemInfo`, whose entries satisfy TItemInfo
const ID_SOURCES: Readonly<Record<string, string>> = { TItem: 'TItemInfo' };

const TYPE_NAME_RE = /\bT[A-Z]\w*/g;

type TWrittenType = { name: string; catalog: boolean };

type TGraph = { written: TWrittenType; structure: TStructureDto };

// `via` is the name the type text mentions; `throughId` when it is a catalog's `keyof typeof`
type TEdge = { to: string; via: string; throughId: boolean };

const idSourceOf = (refName: string, { written, structure }: TGraph): string | undefined => {
    if (refName === written.name) return written.catalog ? written.name : undefined;
    if (refName in ID_SOURCES) return ID_SOURCES[refName];
    return structure.types.some((type) => type.name === refName && type.catalog) ? refName : undefined;
};

const isTypeName = (name: string, { written, structure }: TGraph) =>
    name === written.name || structure.types.some((type) => type.name === name);

const idEdge = (refName: string, g: TGraph): TEdge[] => {
    const source = idSourceOf(refName, g);
    return source ? [{ to: source, via: refIdTypeName(refName), throughId: true }] : [];
};

const textEdges = (text: string, g: TGraph): TEdge[] =>
    [...new Set(text.match(TYPE_NAME_RE) ?? [])].flatMap((name) => {
        const refName = refNameOfIdType(name);
        if (refName) return idEdge(refName, g);
        return isTypeName(name, g) ? [{ to: name, via: name, throughId: false }] : [];
    });

const refEdges = (ref: TTypeRef, g: TGraph): TEdge[] => {
    switch (ref.t) {
        case 'ref':
            return idEdge(ref.name, g);
        case 'array':
            return refEdges(ref.of, g);
        case 'object':
            return ref.fields.flatMap((field) => refEdges(field.type, g));
        case 'function':
            return textEdges(ref.signature, g);
        case 'code':
            return textEdges(ref.code, g);
        default:
            return [];
    }
};

const typeEdges = (name: string, g: TGraph): TEdge[] => {
    const type = g.structure.types.find((t) => t.name === name);
    if (!type) return [];
    return [...type.fields.flatMap((field) => refEdges(field.type, g)), ...textEdges(type.code ?? '', g)];
};

// a cycle of plain type names is fine for tsc; one through a catalog's ids makes them `any`
const cycleFrom = (edges: TEdge[], g: TGraph, throughId = false, seen = new Set<string>()): string[] | null => {
    for (const edge of edges) {
        const viaId = throughId || edge.throughId;
        if (edge.to === g.written.name) {
            if (viaId) return [edge.via];
            continue;
        }
        const state = `${edge.to}:${viaId}`;
        if (seen.has(state)) continue;
        seen.add(state);
        const rest = cycleFrom(typeEdges(edge.to, g), g, viaId, seen);
        if (rest) return [edge.via, ...rest];
    }
    return null;
};

export const assertNoIdCycle = (written: TWrittenType, fields: TFieldDesc[], structure: TStructureDto) => {
    const g: TGraph = { written, structure };
    fields.forEach((field, i) => {
        const cycle = cycleFrom(refEdges(field.type, g), g);
        if (!cycle) return;
        const message = `Field "${field.key}" makes ${cycle[cycle.length - 1]} depend on itself (${[`${written.name}.${field.key}`, ...cycle].join(' → ')}); a catalog's ids cannot be used by its own entries`;
        throw HttpError.invalid([syntaxDiagnostic('', message, `fields.${i}.type`)], message);
    });
};
