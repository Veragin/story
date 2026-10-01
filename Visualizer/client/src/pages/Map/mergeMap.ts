import type { TMapDto } from '@story/visualizer-protocol';
import { createDefaultMapData } from '../../MapEditor/createDefaultMapData';
import type { TMapDocument, TMapTile } from '../../MapEditor/types';

export const toMapDocument = (dto: TMapDto): TMapDocument => {
    const doc: Partial<TMapDto> = structuredClone(dto);
    delete doc.version;
    return doc as TMapDocument;
};

const sameTile = (a: TMapTile | undefined, b: TMapTile | undefined) =>
    a?.tile === b?.tile && (a?.label ?? '') === (b?.label ?? '') && (a?.description ?? '') === (b?.description ?? '');

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const mergeRecord = <T>(base: Record<string, T>, local: Record<string, T>, remote: Record<string, T>) => {
    const result: Record<string, T> = {};
    const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
    for (const key of keys) {
        const changedLocally = !same(local[key], base[key]);
        const value = changedLocally ? local[key] : remote[key];
        if (value !== undefined) result[key] = structuredClone(value);
    }
    return result;
};

// local changes since `base` win; local cell edits outside the remote size are dropped
export const mergeMaps = (base: TMapDocument | null, local: TMapDocument, remote: TMapDocument): TMapDocument => {
    const b = base ?? { ...createDefaultMapData(local.mapId, local.title, local.width, local.height), palette: {} };
    const localResized = local.width !== b.width || local.height !== b.height;
    const width = localResized ? local.width : remote.width;
    const height = localResized ? local.height : remote.height;

    const data: TMapDocument['data'] = [];
    for (let i = 0; i < height; i++) {
        const row: TMapTile[] = [];
        for (let j = 0; j < width; j++) {
            const l = local.data[i]?.[j];
            const changedLocally = l !== undefined && !sameTile(l, b.data[i]?.[j]);
            const cell = (changedLocally ? l : remote.data[i]?.[j]) ?? l ?? { tile: 'none' };
            row.push(structuredClone(cell));
        }
        data.push(row);
    }

    return {
        mapId: remote.mapId,
        title: local.title !== b.title ? local.title : remote.title,
        width,
        height,
        data,
        palette: mergeRecord(b.palette, local.palette, remote.palette),
        locations: mergeRecord(b.locations, local.locations, remote.locations),
        maps: structuredClone(same(local.maps, b.maps) ? remote.maps : local.maps),
    };
};

export const sameMap = (a: TMapDocument | null, b: TMapDocument | null) => same(a, b);
