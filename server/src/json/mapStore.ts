import { GLOBAL_MAP_ID, type TMapDto, type TMapFile, type TVersion } from '@story/protocol';
import { HttpError } from '../common/HttpError';
import type { TTransaction } from '../events/EventBus';
import { assertVersion, version } from '../events/version';
import type { ProjectRoot } from '../project/ProjectRoot';
import type { TServerContext } from '../storyContext/serverContext';
import { readTextOrNull } from './atomicWrite';
import { createDefaultMap, decodeMapFile, encodeMapFile, parseMapDocument } from './mapFile';
import { brokenJsonFileError, expectRecord, parseRequestBody } from './shape';

const mapPath = (project: ProjectRoot, mapId: string): string => {
    if (mapId !== GLOBAL_MAP_ID) throw HttpError.notFound(`No map "${mapId}" (only "${GLOBAL_MAP_ID}" exists)`);
    return project.paths.map;
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

export const readMapFile = async (project: ProjectRoot): Promise<TMapFile | null> =>
    (await load(project, project.paths.map)).map;

export const readMap = async (
    project: ProjectRoot,
    mapId: string,
    size?: { width: number; height: number }
): Promise<TMapDto> => {
    const { map, version } = await load(project, mapPath(project, mapId));
    return { ...(map ?? createDefaultMap(mapId, size)), version };
};

export const writeMapFile = async (tx: TTransaction, map: TMapFile): Promise<TVersion> => {
    const text = await encodeMapFile(map);
    await tx.writeFile(tx.project.paths.map, text);
    return version(text);
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
        const text = await encodeMapFile(map);
        await tx.writeFile(file, text);
        const next = version(text);
        tx.setEvent({ kind: 'map', id: mapId, version: next, op: current.map ? 'updated' : 'created' });
        return { ...decodeMapFile(JSON.parse(text)), version: next };
    });
};
