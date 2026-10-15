import {
    GLOBAL_MAP_ID,
    type TMapDto,
    type TMapFile,
    type TMapTileDto,
    type TVersion,
} from '@story/visualizer-protocol';
import type { TServerContext } from '../context';
import type { TTransaction } from '../events/EventBus';
import { assertVersion, version } from '../events/version';
import { HttpError } from '../http/HttpError';
import type { ProjectRoot } from '../project/ProjectRoot';
import { readTextOrNull } from './atomicWrite';
import { formatJson, sortKeys } from './format';
import {
    brokenJsonFileError,
    expectArray,
    expectInteger,
    expectPoint,
    expectRecord,
    expectString,
    onlyKeys,
    optionalString,
    parseRequestBody,
    ShapeError,
} from './shape';

const MAP_FORMAT = 1;

// keep in sync with the client's MapEditor/createDefaultMapData.ts
const DEFAULT_PALETTE: TMapFile['palette'] = {
    none: { name: 'None', color: '#000000' },
    grass: { name: 'Grass', color: '#D3E671' },
    water: { name: 'Water', color: '#9EC6F3' },
    sand: { name: 'Sand', color: '#F0F1C5' },
    forest: { name: 'Forest', color: '#89AC46' },
    mountain: { name: 'Mountain', color: '#B7B7B7' },
    snow: { name: 'Snow', color: '#eee' },
    lava: { name: 'Lava', color: '#E16A54' },
    city: { name: 'City', color: '#9F5255' },
    road: { name: 'Road', color: '#BF9264' },
};

// row-major (height rows of width tiles) as Draw.ts reads it; the client's builder is transposed
export const createDefaultMap = (
    mapId: string = GLOBAL_MAP_ID,
    { title = 'Untitled', width = 100, height = 100 }: { title?: string; width?: number; height?: number } = {}
): TMapFile => ({
    mapId,
    title,
    width,
    height,
    data: Array.from({ length: height }, () => Array.from({ length: width }, () => ({ tile: 'none' }))),
    palette: { ...DEFAULT_PALETTE },
    locations: {},
    maps: [],
});

const mapPath = (project: ProjectRoot, mapId: string): string => {
    if (mapId !== GLOBAL_MAP_ID) throw HttpError.notFound(`No map "${mapId}" (only "${GLOBAL_MAP_ID}" exists)`);
    return project.paths.map;
};

const COLOR_ID = /^[^\s*]+$/;

const expectColorId = (v: unknown, at: string) => {
    const id = expectString(v, at);
    if (!COLOR_ID.test(id)) throw new ShapeError(at, 'a colour id without whitespace or "*"');
    return id;
};

const parsePalette = (v: unknown, at: string): TMapFile['palette'] => {
    const o = expectRecord(v, at);
    const palette: TMapFile['palette'] = {};
    for (const [id, entry] of Object.entries(o)) {
        const eAt = `${at}.${id}`;
        expectColorId(id, `${at} key "${id}"`);
        const e = expectRecord(entry, eAt);
        onlyKeys(e, eAt, ['name', 'color']);
        palette[id] = { name: expectString(e.name, `${eAt}.name`), color: expectString(e.color, `${eAt}.color`) };
    }
    return palette;
};

const parseTileText = (o: { label?: unknown; description?: unknown }, at: string): Omit<TMapTileDto, 'tile'> => {
    const out: Omit<TMapTileDto, 'tile'> = {};
    const label = optionalString(o.label, `${at}.label`);
    const description = optionalString(o.description, `${at}.description`);
    if (label) out.label = label;
    if (description) out.description = description;
    return out;
};

const parseLocations = (v: unknown, at: string): TMapFile['locations'] => {
    const o = expectRecord(v, at);
    const out: TMapFile['locations'] = {};
    for (const [id, value] of Object.entries(o)) {
        const lAt = `${at}.${id}`;
        const l = expectRecord(value, lAt);
        onlyKeys(l, lAt, ['polygon', 'fill', 'stroke']);
        const polygon = expectArray(l.polygon, `${lAt}.polygon`).map((p, k) => expectPoint(p, `${lAt}.polygon[${k}]`));
        const fill = optionalString(l.fill, `${lAt}.fill`);
        const stroke = optionalString(l.stroke, `${lAt}.stroke`);
        out[id] = { polygon, ...(fill !== undefined && { fill }), ...(stroke !== undefined && { stroke }) };
    }
    return sortKeys(out);
};

const parseSubMaps = (v: unknown, at: string): TMapFile['maps'] =>
    expectArray(v, at).map((m, k) => {
        const mAt = `${at}[${k}]`;
        const o = expectRecord(m, mAt);
        onlyKeys(o, mAt, ['i', 'j', 'mapId']);
        return {
            i: expectInteger(o.i, `${mAt}.i`),
            j: expectInteger(o.j, `${mAt}.j`),
            mapId: expectString(o.mapId, `${mAt}.mapId`),
        };
    });

const parseRows = (v: unknown, at: string, width: number, height: number): TMapTileDto[][] => {
    const rows = expectArray(v, at);
    if (rows.length !== height) throw new ShapeError(at, `${height} rows (height), got ${rows.length}`);
    return rows.map((row, i) => {
        const cells = expectArray(row, `${at}[${i}]`);
        if (cells.length !== width) {
            throw new ShapeError(`${at}[${i}]`, `${width} tiles (width), got ${cells.length}`);
        }
        return cells.map((cell, j) => {
            const cAt = `${at}[${i}][${j}]`;
            const c = expectRecord(cell, cAt);
            onlyKeys(c, cAt, ['tile', 'label', 'description']);
            return { tile: expectColorId(c.tile, `${cAt}.tile`), ...parseTileText(c, cAt) };
        });
    });
};

const MAP_KEYS = ['mapId', 'title', 'width', 'height', 'data', 'palette', 'locations', 'maps'] as const;

const parseMapDocument = (value: unknown): TMapFile => {
    const o = expectRecord(value, '');
    onlyKeys(o, '', MAP_KEYS);
    const width = expectInteger(o.width, 'width', 1);
    const height = expectInteger(o.height, 'height', 1);
    return {
        mapId: expectString(o.mapId, 'mapId'),
        title: expectString(o.title, 'title'),
        width,
        height,
        data: parseRows(o.data, 'data', width, height),
        palette: parsePalette(o.palette, 'palette'),
        locations: parseLocations(o.locations ?? {}, 'locations'),
        maps: parseSubMaps(o.maps ?? [], 'maps'),
    };
};

const encodeRow = (row: TMapTileDto[]): string => {
    const tokens: string[] = [];
    let k = 0;
    while (k < row.length) {
        const tile = row[k].tile;
        let n = 1;
        while (k + n < row.length && row[k + n].tile === tile) n++;
        tokens.push(n === 1 ? tile : `${tile}*${n}`);
        k += n;
    }
    return tokens.join(' ');
};

const decodeRow = (text: string, at: string, width: number): string[] => {
    const out: string[] = [];
    for (const token of text.split(/\s+/).filter(Boolean)) {
        const star = token.lastIndexOf('*');
        const id = star < 0 ? token : token.slice(0, star);
        const count = star < 0 ? 1 : Number(token.slice(star + 1));
        if (!COLOR_ID.test(id) || !Number.isInteger(count) || count < 1) {
            throw new ShapeError(at, `"<colorId>" or "<colorId>*<count>" tokens, got "${token}"`);
        }
        for (let n = 0; n < count; n++) out.push(id);
    }
    if (out.length !== width) throw new ShapeError(at, `${width} tiles (width), got ${out.length}`);
    return out;
};

const tileKey = (i: number, j: number) => `${i},${j}`;

export const encodeMapFile = (map: TMapFile): Promise<string> => {
    const tileText: Record<string, Omit<TMapTileDto, 'tile'>> = {};
    map.data.forEach((row, i) =>
        row.forEach((cell, j) => {
            const text = parseTileText(cell, `data[${i}][${j}]`);
            if (text.label !== undefined || text.description !== undefined) tileText[tileKey(i, j)] = text;
        })
    );
    return formatJson({
        format: MAP_FORMAT,
        mapId: map.mapId,
        title: map.title,
        width: map.width,
        height: map.height,
        palette: map.palette,
        tiles: map.data.map(encodeRow),
        tileText,
        locations: sortKeys(map.locations),
        maps: map.maps,
    });
};

export const decodeMapFile = (value: unknown): TMapFile => {
    const o = expectRecord(value, '');
    if (o.tiles === undefined && o.data !== undefined) {
        const rest = { ...o };
        delete rest.format;
        return parseMapDocument(rest);
    }
    onlyKeys(o, '', [
        'format',
        'mapId',
        'title',
        'width',
        'height',
        'palette',
        'tiles',
        'tileText',
        'locations',
        'maps',
    ]);
    if (o.format !== undefined && o.format !== MAP_FORMAT) {
        throw new ShapeError('format', `${MAP_FORMAT} (this server's map format)`);
    }
    const width = expectInteger(o.width, 'width', 1);
    const height = expectInteger(o.height, 'height', 1);
    const rows = expectArray(o.tiles, 'tiles');
    if (rows.length !== height) throw new ShapeError('tiles', `${height} rows (height), got ${rows.length}`);
    const data: TMapTileDto[][] = rows.map((row, i) =>
        decodeRow(expectString(row, `tiles[${i}]`), `tiles[${i}]`, width).map((tile) => ({ tile }))
    );
    for (const [key, value] of Object.entries(expectRecord(o.tileText ?? {}, 'tileText'))) {
        const at = `tileText.${key}`;
        const m = /^(\d+),(\d+)$/.exec(key);
        const i = m ? Number(m[1]) : -1;
        const j = m ? Number(m[2]) : -1;
        if (!m || i >= height || j >= width)
            throw new ShapeError(at, `a "<row>,<col>" key inside the ${height}x${width} grid`);
        const t = expectRecord(value, at);
        onlyKeys(t, at, ['label', 'description']);
        Object.assign(data[i][j], parseTileText(t, at));
    }
    return {
        mapId: expectString(o.mapId, 'mapId'),
        title: expectString(o.title, 'title'),
        width,
        height,
        data,
        palette: parsePalette(o.palette, 'palette'),
        locations: parseLocations(o.locations ?? {}, 'locations'),
        maps: parseSubMaps(o.maps ?? [], 'maps'),
    };
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
