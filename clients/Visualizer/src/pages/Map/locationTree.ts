import { GLOBAL_MAP_ID, SUBLOCATION_SEPARATOR } from '@story/protocol';

type TIds = { has(id: string): boolean };

// the longest existing prefix wins: `village_old_mill` belongs to `village_old` when that location exists
export const parentLocationId = (id: string, ids: TIds): string | null => {
    const parts = id.split(SUBLOCATION_SEPARATOR);
    for (let n = parts.length - 1; n > 0; n--) {
        const prefix = parts.slice(0, n).join(SUBLOCATION_SEPARATOR);
        if (ids.has(prefix)) return prefix;
    }
    return null;
};

export const mapIdOfLocation = (id: string, ids: TIds): string => parentLocationId(id, ids) ?? GLOBAL_MAP_ID;

export const locationIdPrefix = (mapId: string): string =>
    mapId === GLOBAL_MAP_ID ? '' : `${mapId}${SUBLOCATION_SEPARATOR}`;

export const isOnMap = (id: string, mapId: string, ids: TIds): boolean => mapIdOfLocation(id, ids) === mapId;

// deepest first, so each one is deleted before the location it lies in
export const descendantLocationIds = (id: string, ids: Iterable<string>): string[] =>
    [...ids]
        .filter((other) => other.startsWith(locationIdPrefix(id)))
        .sort((a, b) => b.split(SUBLOCATION_SEPARATOR).length - a.split(SUBLOCATION_SEPARATOR).length);

export const mapAncestors = (mapId: string, ids: TIds): string[] => {
    const chain: string[] = [];
    for (let id: string | null = mapId; id && id !== GLOBAL_MAP_ID; id = parentLocationId(id, ids)) chain.unshift(id);
    return [GLOBAL_MAP_ID, ...chain];
};

export const locationIdFromName = (name: string): string =>
    name
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .split(/[^A-Za-z0-9]+/)
        .filter(Boolean)
        .map((word, i) =>
            i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join('');
