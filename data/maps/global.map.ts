import { TMap } from '@story/types';

/**
 * The story's world map (VISUALIZER_PLAN §4.3).
 *
 * Coordinates are world units and the origin is the top-left corner, matching every other
 * coordinate in the Visualizer. `size` is what "fit the map on screen" frames and what the
 * editor treats as the drawable area; nothing enforces that shapes stay inside it, because an
 * author sketching a coastline should not be stopped by a boundary they can move.
 *
 * The locations drawn on this map are *not* listed here — each carries its own polygon in its
 * own file, under `TLocation.shape`. See the note in `types/TMap.ts` for why.
 */
export const globalMap: TMap<'global'> = {
    id: 'global',
    title: 'The Kingdom',

    size: { width: 2000, height: 1400 },

    notes: [{ id: 'note-nen', text: 'The Nen', position: { x: 640, y: 760 }, rotation: -18, color: '#ffffff' }],

    strokes: [
        {
            id: 'stroke-nen',
            color: '#3f6fa8',
            width: 14,
            points: [420, 1080, 560, 940, 700, 860, 880, 820, 1060, 760, 1240, 640],
        },
        {
            id: 'mucuapm3-1',
            color: '#c0504d',
            width: 6,
            points: [
                824, 935, 841, 944, 857, 927, 874, 933, 890, 936, 906, 937, 923, 934, 955, 922, 1004, 897, 1021, 890,
                1037, 885, 1054, 884, 1070, 885, 1103, 895, 1168, 928, 1184, 933,
            ],
        },
    ],
};
