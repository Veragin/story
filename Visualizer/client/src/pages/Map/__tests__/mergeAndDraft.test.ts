import '@story/shared';
import { describe, expect, it } from 'vitest';
import type { TLocationDto } from '@story/visualizer-protocol';
import { createDefaultMapData } from '../../../MapEditor/createDefaultMapData';
import { mergeMaps } from '../mergeMap';
import { fromTextDraft, locationPatch, toLocationDraft, toTextDraft } from '../LocationForm/draft';

const clone = <T>(v: T): T => structuredClone(v);

describe('mergeMaps', () => {
    const base = createDefaultMapData('global', 'World', 4, 3);
    base.locations.a = { polygon: [{ x: 0, y: 0 }] };
    base.locations.b = { polygon: [{ x: 1, y: 1 }] };

    it('takes local edits over remote ones and remote ones elsewhere', () => {
        const local = clone(base);
        const remote = clone(base);
        local.data[0][0] = { tile: 'grass' };
        remote.data[0][0] = { tile: 'water' };
        remote.data[2][3] = { tile: 'forest', description: 'x' };
        delete local.locations.a;
        remote.locations.b = { polygon: [{ x: 9, y: 9 }] };
        remote.locations.c = { polygon: [{ x: 5, y: 5 }] };
        local.palette.ice = { name: 'Ice', color: '#fff' };
        remote.title = 'Renamed';

        const merged = mergeMaps(base, local, remote);
        expect(merged.data[0][0].tile).toBe('grass');
        expect(merged.data[2][3]).toEqual({ tile: 'forest', description: 'x' });
        expect(merged.locations.a).toBeUndefined();
        expect(merged.locations.b.polygon[0].x).toBe(9);
        expect(merged.locations.c).toBeDefined();
        expect(merged.palette.ice).toBeDefined();
        expect(merged.title).toBe('Renamed');
    });

    it('follows a remote resize and keeps local cells that still fit', () => {
        const local = clone(base);
        local.data[1][1] = { tile: 'grass' };
        const remote = createDefaultMapData('global', 'World', 6, 2);
        const merged = mergeMaps(base, local, remote);
        expect([merged.width, merged.height]).toEqual([6, 2]);
        expect(merged.data).toHaveLength(2);
        expect(merged.data[0]).toHaveLength(6);
        expect(merged.data[1][1].tile).toBe('grass');
    });

    it('without a base (the map was never saved), keeps every local change', () => {
        const local = createDefaultMapData('global', 'World', 4, 3);
        local.data[0][1] = { tile: 'grass' };
        local.locations.x = { polygon: [] };
        const remote = clone(base);
        remote.data[2][2] = { tile: 'water' };
        const merged = mergeMaps(null, local, remote);
        expect(merged.data[0][1].tile).toBe('grass');
        expect(merged.data[2][2].tile).toBe('water');
        expect(Object.keys(merged.locations).sort()).toEqual(['a', 'b', 'x']);
    });
});

describe('location form draft', () => {
    const dto: TLocationDto = {
        kind: 'locations',
        id: 'kingdom',
        version: 'v1',
        file: 'data/locations/kingdom.location.ts',
        name: { code: "_('kingdom')" },
        description: 'Big',
        localCharacters: [{ name: 'Pepa', description: { code: 'describe()' } }],
        init: {},
    };

    it('edits _() values as text and writes them back translated', () => {
        expect(toTextDraft({ code: "_('It\\'s here')" })).toEqual({ kind: 'translated', text: "It's here" });
        expect(fromTextDraft({ kind: 'translated', text: "It's\nhere" })).toEqual({ code: "_('It\\'s\\nhere')" });
        expect(toTextDraft({ code: 'a + b' })).toEqual({ kind: 'code', code: 'a + b' });
        expect(toTextDraft(undefined)).toEqual({ kind: 'text', text: '' });
    });

    it('patches only the fields that changed', () => {
        const draft = toLocationDraft(dto);
        expect(locationPatch(dto, draft)).toEqual({});
        draft.description = { kind: 'text', text: 'Bigger' };
        expect(locationPatch(dto, draft)).toEqual({ description: 'Bigger' });
        if (draft.localCharacters.kind !== 'list') throw new Error('list expected');
        draft.localCharacters.rows.push({
            key: 99,
            name: { kind: 'text', text: 'Jan' },
            description: { kind: 'text', text: '' },
        });
        expect(locationPatch(dto, draft).localCharacters).toEqual([
            { name: 'Pepa', description: { code: 'describe()' } },
            { name: 'Jan', description: '' },
        ]);
        expect(locationPatch(dto, draft).name).toBeUndefined();
    });
});

describe('location colours', () => {
    it('reads the colour from the stroke, a hex fill or an rgba() fill, else a stable default', async () => {
        const { locationColor, locationStyle, defaultLocationColor } = await import('../MapPageStore');
        expect(locationColor('a', { polygon: [], stroke: '#336699' })).toBe('#336699');
        expect(locationColor('a', { polygon: [], fill: '#33669959' })).toBe('#336699');
        expect(locationColor('a', { polygon: [], fill: 'rgba(159, 82, 85, 0.35)' })).toBe('#9f5255');
        expect(locationColor('a', { polygon: [] })).toBe(defaultLocationColor('a'));
        expect(locationStyle('#336699')).toEqual({ fill: '#33669959', stroke: '#336699' });
    });
});
