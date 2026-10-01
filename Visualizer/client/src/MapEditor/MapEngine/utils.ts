import type { TRect, TSize } from '../../canvas';
import type { TMapDocument, TTile } from '../types';
import { HEX_RADIUS, MAP_TILE_AVG_HEIGHT, MAP_TILE_WIDTH, MINIMAP_RATIO } from './constants';

export const computeTilePos = (i: number, j: number) => {
    const isOdd = Math.abs(i % 2);
    const x = j * MAP_TILE_WIDTH + MAP_TILE_WIDTH / 2 + (isOdd * MAP_TILE_WIDTH) / 2;
    const y = i * MAP_TILE_AVG_HEIGHT;
    return { x, y };
};

// nearest centre among neighbours: rounding alone misattributes the pointed hex corners
export const computeTileIndex = (x: number, y: number): TTile => {
    const ci = Math.round(y / MAP_TILE_AVG_HEIGHT);
    let best: TTile = { i: ci, j: 0 };
    let bestDist = Infinity;
    for (let i = ci - 1; i <= ci + 1; i++) {
        const cj = Math.round((x - MAP_TILE_WIDTH / 2 - (Math.abs(i % 2) * MAP_TILE_WIDTH) / 2) / MAP_TILE_WIDTH);
        for (let j = cj - 1; j <= cj + 1; j++) {
            const c = computeTilePos(i, j);
            const d = (c.x - x) ** 2 + (c.y - y) ** 2;
            if (d < bestDist) {
                bestDist = d;
                best = { i, j };
            }
        }
    }
    return best;
};

export const isInsideMap = (map: Pick<TMapDocument, 'width' | 'height'>, { i, j }: TTile) =>
    i >= 0 && j >= 0 && i < map.height && j < map.width;

export const mapWorldBounds = (map: Pick<TMapDocument, 'width' | 'height'>): TRect => ({
    x: 0,
    y: -HEX_RADIUS,
    width: (map.width + 0.5) * MAP_TILE_WIDTH,
    height: Math.max(0, map.height - 1) * MAP_TILE_AVG_HEIGHT + 2 * HEX_RADIUS,
});

export const minimapSize = (size: TSize, map: Pick<TMapDocument, 'width' | 'height'>) => {
    const bounds = mapWorldBounds(map);
    const height = size.height * MINIMAP_RATIO;
    return { width: (bounds.width / Math.max(1, bounds.height)) * height, height };
};

export const findNeighbor = (si: number, sj: number, size: number, maxI: number, maxJ: number) => {
    const pack: TTile[] = [];
    const isOdd = Math.abs(si % 2);
    for (let j = sj - size + 1; j < sj + size; j++) {
        if (si >= 0 && j >= 0 && si < maxI && j < maxJ) pack.push({ i: si, j: j });
    }
    for (let i = 1; i < size; i++) {
        for (
            let j = sj - size + 1 + (i % 2) * (2 * isOdd - 1) + (i - isOdd + ((i - isOdd) % 2)) / 2;
            j < sj + size - (i - isOdd + ((i - isOdd) % 2)) / 2;
            j++
        ) {
            if (si + i >= 0 && j >= 0 && si + i < maxI && j < maxJ) pack.push({ i: si + i, j: j });
            if (si - i >= 0 && j >= 0 && si - i < maxI && j < maxJ) pack.push({ i: si - i, j: j });
        }
    }
    return pack;
};
