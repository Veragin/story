import { MAP_TILE_AVG_HEIGHT, MAP_TILE_WIDTH, MINIMAP_RATIO } from './constants';

export const computeTilePos = (i: number, j: number) => {
    const isOdd = i % 2;
    const x = j * MAP_TILE_WIDTH + MAP_TILE_WIDTH / 2 + (isOdd * MAP_TILE_WIDTH) / 2;
    const y = i * MAP_TILE_AVG_HEIGHT;
    return { x, y };
};

export const computeTileIndex = (x: number, y: number) => {
    const i = Math.round(y / MAP_TILE_AVG_HEIGHT);
    const j = Math.round((x - MAP_TILE_WIDTH / 2 - ((i % 2) * MAP_TILE_WIDTH) / 2) / MAP_TILE_WIDTH);
    return { i, j };
};

export const minimapSize = (canvas: HTMLCanvasElement) => {
    return {
        width: canvas.width * MINIMAP_RATIO,
        height: canvas.height * MINIMAP_RATIO,
    };
};

export const findNeighbor = (si: number, sj: number, size: number, maxI: number, maxJ: number) => {
    const pack = [];
    const isOdd = si % 2;
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
