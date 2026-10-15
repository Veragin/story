import '@story/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Camera } from '../../canvas';
import {
    createCanvas,
    fire,
    flushFrames,
    installFrames,
    pendingFrames,
    uninstallFrames,
} from '../../canvas/__tests__/helpers';
import { createDefaultMapData } from '../createDefaultMapData';
import { MapStore, type IMapHost } from '../MapStore';
import { computeTileIndex, computeTilePos, findNeighbor, mapWorldBounds } from '../MapEngine/utils';
import { descriptionLines, textColorFor } from '../MapEngine/Draw';
import { HEX_POINTS } from '../MapEngine/constants';
import type { TMapDocument } from '../types';

type TCalls = { name: string; args: unknown[] }[];
const callsOf = (canvas: HTMLCanvasElement) => (canvas.getContext('2d') as unknown as { __calls: TCalls }).__calls;

const makeHost = (map: TMapDocument, camera = new Camera()) => {
    const host: IMapHost & { edits: number } = {
        map,
        camera,
        edits: 0,
        onMapEdited() {
            host.edits++;
        },
    };
    return host;
};

beforeEach(() => {
    installFrames();
    sessionStorage.clear();
});
afterEach(() => {
    uninstallFrames();
    document.body.innerHTML = '';
});

describe('createDefaultMapData', () => {
    it('builds `height` rows of `width` tiles (it used to be transposed)', () => {
        const map = createDefaultMapData('global', 'World', 7, 3);
        expect(map.data).toHaveLength(3);
        expect(map.data.every((row) => row.length === 7)).toBe(true);
        expect(map.locations).toEqual({});
        expect(map.palette.none).toBeDefined();
    });
});

describe('hex geometry', () => {
    it('finds the tile under a point, including near the pointed hex corners', () => {
        for (const [i, j] of [
            [0, 0],
            [1, 0],
            [3, 5],
            [4, 2],
        ]) {
            const c = computeTilePos(i, j);
            expect(computeTileIndex(c.x, c.y)).toEqual({ i, j });
            // just inside the top and bottom corners of the hexagon
            expect(computeTileIndex(c.x + HEX_POINTS[0].x, c.y + HEX_POINTS[0].y - 2)).toEqual({ i, j });
            expect(computeTileIndex(c.x + HEX_POINTS[3].x, c.y + HEX_POINTS[3].y + 2)).toEqual({ i, j });
        }
    });

    it('clips the brush to the map: rows against height, columns against width', () => {
        const tiles = findNeighbor(0, 9, 2, 3, 10);
        expect(tiles.every((t) => t.i >= 0 && t.i < 3 && t.j >= 0 && t.j < 10)).toBe(true);
        expect(tiles).toContainEqual({ i: 0, j: 9 });
    });

    it('computes the map bounds from columns (width) and rows (height)', () => {
        const wide = mapWorldBounds({ width: 20, height: 2 });
        expect(wide.width).toBeGreaterThan(wide.height);
    });
});

describe('MapStore editing', () => {
    it('paints the brush, sets tile texts and palette colours, and reports each edit to the host', () => {
        const map = createDefaultMapData('global', 'World', 10, 10);
        const host = makeHost(map);
        const store = new MapStore(host);
        store.setBrushSize(1);
        store.setSelectedColorId('water');
        expect(store.paint({ i: 2, j: 2 })).toBe(true);
        expect(map.data[2][2].tile).toBe('water');
        expect(store.paint({ i: 2, j: 2 })).toBe(false);

        store.setTileText({ i: 2, j: 2 }, { label: 'Lake', description: 'Cold' });
        expect(map.data[2][2]).toEqual({ tile: 'water', label: 'Lake', description: 'Cold' });
        store.setTileText({ i: 2, j: 2 }, { description: '' });
        expect(map.data[2][2]).toEqual({ tile: 'water', label: 'Lake' });

        store.setPaletteColor('ice', { name: 'Ice', color: '#ddeeff' });
        expect(store.selectedColorId).toBe('ice');
        store.deleteColor();
        expect(map.palette.ice).toBeUndefined();
        expect(host.edits).toBe(5);
    });

    it('deleting a colour turns its tiles into none', () => {
        const map = createDefaultMapData('global', 'World', 4, 4);
        map.data[1][1].tile = 'grass';
        const store = new MapStore(makeHost(map));
        store.setSelectedColorId('grass');
        store.deleteColor();
        expect(map.data[1][1].tile).toBe('none');
    });
});

describe('tiles canvas', () => {
    const attach = (zoom = 1) => {
        const map = createDefaultMapData('global', 'World', 12, 8);
        map.data[1][1] = { tile: 'grass', label: 'Meadow', description: 'Flowers everywhere' };
        const camera = new Camera({ x: 0, y: -40, zoom });
        const host = makeHost(map, camera);
        const store = new MapStore(host);
        const canvas = createCanvas(800, 600);
        const detach = store.attach(canvas);
        return { map, camera, host, store, canvas, detach };
    };

    it('listens on the canvas, not on document, and removes everything on detach', () => {
        const docAdd = vi.spyOn(document, 'addEventListener');
        const { canvas, detach, store } = attach();
        expect(docAdd).not.toHaveBeenCalled();
        const remove = vi.spyOn(canvas, 'removeEventListener');
        detach();
        expect(remove.mock.calls.map((c) => c[0])).toEqual(
            expect.arrayContaining(['pointerdown', 'pointermove', 'wheel', 'contextmenu'])
        );
        expect(store.draw).toBeNull();
    });

    it('redraws on demand only and cancels its frame on destroy', () => {
        const { camera, detach } = attach();
        flushFrames(3);
        expect(pendingFrames()).toBe(0); // no endless loop
        camera.set({ x: 10 });
        expect(pendingFrames()).toBe(1);
        detach();
        expect(pendingFrames()).toBe(0);
        camera.set({ x: 20 });
        expect(pendingFrames()).toBe(0);
    });

    it('draws tile labels when zoomed in, and descriptions only when zoomed in further', () => {
        const texts = (zoom: number) => {
            const { canvas, detach } = attach(zoom);
            callsOf(canvas).length = 0;
            flushFrames();
            const out = callsOf(canvas)
                .filter((c) => c.name === 'fillText')
                .map((c) => c.args[0]);
            detach();
            return out;
        };
        expect(texts(0.4)).toEqual([]);
        expect(texts(1)).toEqual(['Meadow']);
        const zoomedIn = texts(2);
        expect(zoomedIn[0]).toBe('Meadow');
        expect(zoomedIn.slice(1).join(' ')).toBe('Flowers everywhere');
    });

    it('ignores the pointer unless interactive; then paints, selects and zooms', () => {
        const { canvas, store, map, camera } = attach();
        store.setBrushSize(1);
        store.setSelectedColorId('water');
        const pos = computeTilePos(3, 4);
        const screen = camera.worldToScreen(pos);

        fire(canvas, 'pointerdown', screen.x, screen.y);
        fire(canvas, 'pointerup', screen.x, screen.y);
        expect(map.data[3][4].tile).toBe('none');

        store.setInteractive(true);
        fire(canvas, 'pointerdown', screen.x, screen.y);
        fire(canvas, 'pointerup', screen.x, screen.y);
        expect(map.data[3][4].tile).toBe('water');

        store.setTool('select');
        fire(canvas, 'pointerdown', screen.x, screen.y);
        fire(canvas, 'pointerup', screen.x, screen.y);
        expect(store.selectedTile).toEqual({ i: 3, j: 4 });

        const wheel = (init: WheelEventInit) =>
            canvas.dispatchEvent(new WheelEvent('wheel', { clientX: 100, clientY: 100, cancelable: true, ...init }));
        wheel({ deltaY: -100 });
        expect(camera.zoom).toBeGreaterThan(1);
        const zoom = camera.zoom;
        wheel({ deltaY: -100, shiftKey: true });
        expect(camera.zoom).toBe(zoom);
        expect(store.brushSize).toBe(2);
    });

    it('right-drag pans the shared camera', () => {
        const { canvas, store, camera } = attach();
        store.setInteractive(true);
        fire(canvas, 'pointerdown', 300, 300, { button: 2 });
        fire(canvas, 'pointermove', 250, 280, { button: 2 });
        fire(canvas, 'pointerup', 250, 280, { button: 2 });
        expect(camera.x).toBe(50);
        expect(camera.y).toBe(-20);
    });
});

describe('text helpers', () => {
    it('picks a readable text colour and limits descriptions to a few lines', () => {
        expect(textColorFor('#eeeeee')).toBe('#111111');
        expect(textColorFor('#101010')).toBe('#ffffff');
        expect(textColorFor(undefined)).toBe('#ffffff');
        const lines = descriptionLines('word '.repeat(200));
        expect(lines.length).toBeLessThanOrEqual(4);
        expect(lines[lines.length - 1].endsWith('…')).toBe(true);
    });
});
