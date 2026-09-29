/**
 * `data/locations/map.json` — the map store behind `GET/PUT /maps/:mapId` (plan §1, WP2/WP4).
 *
 * The API speaks `TMapDto` (protocol `dto/map.ts`: `data[i][j]` is row `i` of `height`, column `j`
 * of `width`, every tile an object). The file on disk is a compact, diff-friendly encoding of the
 * same document, written by `encodeMapFile` and read back by `decodeMapFile`:
 *
 *     {
 *         "format": 1,
 *         "mapId": "global",
 *         "title": "World",
 *         "width": 12,                          // columns per row
 *         "height": 8,                          // rows
 *         "palette": {                          // in the author's order (it is the palette's UI order)
 *             "none": { "name": "None", "color": "#000000" },
 *             "grass": { "name": "Grass", "color": "#D3E671" }
 *         },
 *         "tiles": [                            // one string per row, `height` of them, top to bottom
 *             "water*12",                       // run-length encoded: `<colorId>` or `<colorId>*<count>`,
 *             "grass*3 city grass*8"            //   space separated, `width` tiles per row
 *         ],
 *         "tileText": {                         // sparse: only tiles with a label / description,
 *             "1,3": { "label": "Village", "description": "A few houses." }   // "<row>,<col>", sorted
 *         },
 *         "locations": {                        // sorted by location id
 *             "village": { "polygon": [{ "x": 100, "y": 180 }, …], "fill": "…" }
 *         },
 *         "maps": [{ "i": 2, "j": 5, "mapId": "cave" }]
 *     }
 *
 * So painting one tile is a one-line diff (its row), moving a polygon vertex is one line, and a
 * label edit is one line of `tileText`. The JSON is prettier-clean (`format.ts`).
 *
 * Rules the encoding needs: colour ids (palette keys and `tile` values) contain no whitespace and
 * no `*`; a PUT breaking that is a 400. An empty `label` / `description` is dropped. When reading,
 * `format` may be absent and a file may carry the DTO's `data` (array of rows of tile objects)
 * instead of `tiles` + `tileText`, so a hand-written map in the API shape loads too.
 */
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
    expectArray,
    expectInteger,
    expectPoint,
    expectRecord,
    expectString,
    onlyKeys,
    optionalString,
    ShapeError,
} from './shape';

export const MAP_FORMAT = 1;

/** The palette of a new map — the same one as the client's `MapEditor/createDefaultMapData.ts`. */
export const DEFAULT_PALETTE: TMapFile['palette'] = {
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

/**
 * What `GET` answers while `map.json` does not exist (with `version: ''`): the client's
 * `createDefaultMapData(id, 'Untitled', 100, 100)`, but with `height` rows of `width` tiles
 * (`data[i][j]`, row `i`), which is how `Draw.ts` reads it; the client builds it transposed
 * (a WP4 bug, plan §2 — harmless for the square default).
 */
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

/** The file behind a map id, or 404 (only `global` exists, plan §1.1). */
export const mapPath = (project: ProjectRoot, mapId: string): string => {
    if (mapId !== GLOBAL_MAP_ID) throw HttpError.notFound(`No map "${mapId}" (only "${GLOBAL_MAP_ID}" exists)`);
    return project.paths.map;
};

// ---------------------------------------------------------------------------------------------
// validation of the API shape (PUT body)

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

const parseTileText = (o: Record<string, unknown>, at: string): Omit<TMapTileDto, 'tile'> => {
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

/** Check and normalise a map in the API shape (`TMapFile`, i.e. a PUT body without `version`). */
export const parseMapDocument = (value: unknown): TMapFile => {
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

// ---------------------------------------------------------------------------------------------
// the on-disk encoding

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

/** The file text for a (valid) map document. */
export const encodeMapFile = (map: TMapFile): Promise<string> => {
    const tileText: Record<string, Omit<TMapTileDto, 'tile'>> = {};
    map.data.forEach((row, i) =>
        row.forEach((cell, j) => {
            const text = parseTileText(cell as Record<string, unknown>, `data[${i}][${j}]`);
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
        tileText, // row-major order already
        locations: sortKeys(map.locations),
        maps: map.maps,
    });
};

/** Parse the parsed JSON of a `map.json` back into the API shape. Throws `ShapeError`. */
export const decodeMapFile = (value: unknown): TMapFile => {
    const o = expectRecord(value, '');
    if (o.tiles === undefined && o.data !== undefined) {
        // a hand-written file in the API shape
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

// ---------------------------------------------------------------------------------------------
// store

const brokenFile = (project: ProjectRoot, file: string, e: unknown): HttpError => {
    const message = e instanceof ShapeError ? e.message : `Not valid JSON: ${(e as Error).message}`;
    return HttpError.invalid(
        [{ file: project.rel(file), line: 1, column: 1, message }],
        `${project.rel(file)}: ${message}`
    );
};

/** The map file as it is on disk: its document (or `null` when missing) and version. */
const load = async (project: ProjectRoot, file: string): Promise<{ map: TMapFile | null; version: TVersion }> => {
    const text = await readTextOrNull(file);
    if (text === null) return { map: null, version: version(null) };
    try {
        return { map: decodeMapFile(JSON.parse(text)), version: version(text) };
    } catch (e) {
        throw brokenFile(project, file, e);
    }
};

/** The global map's document, or `null` when `map.json` does not exist (422 when it is broken). */
export const readMapFile = async (project: ProjectRoot): Promise<TMapFile | null> =>
    (await load(project, project.paths.map)).map;

/**
 * `GET /maps/:mapId`: the map, or an empty map with `version: ''` while there is no file. The
 * empty map has `size` when given (the story's `mapSize`), else `createDefaultMap`'s default.
 */
export const readMap = async (
    project: ProjectRoot,
    mapId: string,
    size?: { width: number; height: number }
): Promise<TMapDto> => {
    const { map, version } = await load(project, mapPath(project, mapId));
    return { ...(map ?? createDefaultMap(mapId, size)), version };
};

/** Write the global map inside a transaction (no event); returns the new version. */
export const writeMapFile = async (tx: TTransaction, map: TMapFile): Promise<TVersion> => {
    const text = await encodeMapFile(map);
    await tx.writeFile(tx.project.paths.map, text);
    return version(text);
};

/** `PUT /maps/:mapId`: validated whole-document replace, 409 `stale` on a version mismatch. */
export const updateMap = async (
    { project, bus }: Pick<TServerContext, 'project' | 'bus'>,
    mapId: string,
    body: unknown
): Promise<TMapDto> => {
    const file = mapPath(project, mapId);
    const { version: expected, ...document } = expectRecord(body, '') as Record<string, unknown>;
    let map: TMapFile;
    try {
        map = parseMapDocument(document);
    } catch (e) {
        if (e instanceof ShapeError) throw HttpError.badRequest(e.message);
        throw e;
    }
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
