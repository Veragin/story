import {
    GLOBAL_MAP_ID,
    SUBLOCATION_SEPARATOR,
    type TMapDto,
    type TMapFile,
    type TOkDto,
    type TVersion,
} from '@story/protocol';
import { HttpError } from '../common/HttpError';
import type { TTransaction } from '../events/EventBus';
import { assertVersion, version } from '../events/version';
import type { ProjectRoot } from '../project/ProjectRoot';
import { ID_RE } from '../project/story';
import type { TServerContext } from '../storyContext/serverContext';
import { readTextOrNull } from './atomicWrite';
import { createDefaultMap, decodeMapFile, encodeMapFile, parseMapDocument } from './mapFile';
import { brokenJsonFileError, expectRecord, parseRequestBody } from './shape';

const mapPath = (project: ProjectRoot, mapId: string): string => {
    if (mapId === GLOBAL_MAP_ID) return project.paths.map;
    if (!ID_RE.test(mapId)) throw HttpError.notFound(`No map "${mapId}"`);
    return project.paths.locationMap(mapId);
};

const load = async (project: ProjectRoot, file: string): Promise<{ map: TMapFile | null; version: TVersion }> => {
    const text = await readTextOrNull(file);
    if (text === null) return { map: null, version: version(null) };
    try {
        return { map: decodeMapFile(JSON.parse(text)), version: version(text) };
    } catch (e) {
        throw brokenJsonFileError(project, file, e);
    }
};

const writeMap = async (tx: TTransaction, map: TMapFile): Promise<string> => {
    const text = await encodeMapFile(map);
    await tx.writeFile(mapPath(tx.project, map.mapId), text);
    return text;
};

export const readMapFile = async (project: ProjectRoot, mapId: string = GLOBAL_MAP_ID): Promise<TMapFile | null> =>
    (await load(project, mapPath(project, mapId))).map;

export const writeMapFile = async (tx: TTransaction, map: TMapFile): Promise<TVersion> =>
    version(await writeMap(tx, map));

// only the global map exists without a file; a location's map is created by the first PUT
export const readMap = async (
    project: ProjectRoot,
    mapId: string,
    size?: { width: number; height: number }
): Promise<TMapDto> => {
    const { map, version } = await load(project, mapPath(project, mapId));
    if (map) return { ...map, version };
    if (mapId !== GLOBAL_MAP_ID) throw HttpError.notFound(`No map "${mapId}"`);
    return { ...createDefaultMap(mapId, size), version };
};

export const updateMap = async (
    { project, bus }: Pick<TServerContext, 'project' | 'bus'>,
    mapId: string,
    body: unknown
): Promise<TMapDto> => {
    const file = mapPath(project, mapId);
    const { version: expected, ...document } = expectRecord(body, '');
    const map = parseRequestBody(parseMapDocument, document);
    if (map.mapId !== mapId) throw HttpError.badRequest(`mapId: expected "${mapId}" (the URL's), got "${map.mapId}"`);

    return await bus.transaction(async (tx) => {
        const current = await load(project, file);
        await assertVersion(String(expected), current.version, () => ({
            ...(current.map ?? createDefaultMap(mapId)),
            version: current.version,
        }));
        const text = await writeMap(tx, map);
        const next = version(text);
        tx.setEvent({ kind: 'map', id: mapId, version: next, op: current.map ? 'updated' : 'created' });
        return { ...decodeMapFile(JSON.parse(text)), version: next };
    });
};

export const deleteMap = async (
    { project, bus }: Pick<TServerContext, 'project' | 'bus'>,
    mapId: string,
    body: unknown
): Promise<TOkDto> => {
    if (mapId === GLOBAL_MAP_ID) throw HttpError.badRequest(`The "${GLOBAL_MAP_ID}" map cannot be deleted`);
    const file = mapPath(project, mapId);
    const { version: expected } = expectRecord(body, '');

    return await bus.transaction(async (tx) => {
        const current = await load(project, file);
        if (!current.map) throw HttpError.notFound(`No map "${mapId}"`);
        await assertVersion(String(expected), current.version, () => ({ ...current.map, version: current.version }));
        await tx.deleteFile(file);
        tx.setEvent({ kind: 'map', id: mapId, version: null, op: 'deleted' });
        return { ok: true };
    });
};

// `village_old_mill` may sit on the map of `village`, of `village_old` or on the global one
export const mapsThatMayHoldLocation = (locationId: string): string[] => {
    const parts = locationId.split(SUBLOCATION_SEPARATOR);
    return [GLOBAL_MAP_ID, ...parts.slice(1).map((_part, i) => parts.slice(0, i + 1).join(SUBLOCATION_SEPARATOR))];
};
