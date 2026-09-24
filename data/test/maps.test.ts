import { describe, expect, it } from 'vitest';
import { area, isSelfIntersecting, isClockwise, openRing } from '@story/canvas';
import { register } from '../index';
import { assets } from '../assets';

/**
 * Schema and reference-integrity checks over the author's maps and the location polygons drawn
 * on them (VISUALIZER_PLAN §4.2, §4.3; Phase 3's gate).
 *
 * Same principle as `story.test.ts`: everything is derived from `register` rather than
 * hard-coded, so adding a map or giving a location a shape extends the coverage instead of
 * dating it.
 *
 * ## Why this imports `@story/canvas`
 *
 * The invariants a stored polygon has to hold — open ring, clockwise winding, no
 * self-intersection — are exactly the ones the Visualizer normalises on write, and they are
 * implemented once, in `@story/canvas`'s geometry module. Re-implementing a shoelace formula
 * here so the test could stay dependency-free would mean the test could pass while the writer
 * was wrong, which is the one outcome worth ruling out. `canvas` imports only `@story/shared`,
 * so this adds no cycle: it is a leaf package being used as a library.
 */

const maps = Object.entries(register.maps);
const locations = Object.entries(register.locations);
const locationsWithShape = locations.filter(([, location]) => location.shape !== undefined);

describe('map registration', () => {
    it('keys every map by the id the entry declares', () => {
        for (const [id, map] of maps) {
            expect(map.id, `maps.${id}.id`).toBe(id);
        }
    });

    it('gives every map a title and a positive size', () => {
        for (const [id, map] of maps) {
            expect(map.title, `maps.${id}.title`).toBeTruthy();
            expect(map.size.width, `maps.${id}.size.width`).toBeGreaterThan(0);
            expect(map.size.height, `maps.${id}.size.height`).toBeGreaterThan(0);
        }
    });

    it('resolves every background asset it names', () => {
        for (const [id, map] of maps) {
            if (!map.background) continue;
            expect(Object.keys(assets), `maps.${id}.background.asset`).toContain(map.background.asset);
        }
    });

    it('points every nested map at a registered map', () => {
        const ids = Object.keys(register.maps);
        for (const [id, map] of maps) {
            for (const nested of map.maps ?? []) {
                expect(ids, `maps.${id} nests unknown map "${nested.mapId}"`).toContain(nested.mapId);
            }
        }
    });

    it('does not nest a map inside itself', () => {
        for (const [id, map] of maps) {
            for (const nested of map.maps ?? []) {
                expect(nested.mapId, `maps.${id} nests itself`).not.toBe(id);
            }
        }
    });
});

describe('map notes and strokes', () => {
    it('gives every note and stroke an id unique within its map', () => {
        for (const [id, map] of maps) {
            const noteIds = map.notes.map((note) => note.id);
            expect(new Set(noteIds).size, `maps.${id} has duplicate note ids`).toBe(noteIds.length);

            const strokeIds = map.strokes.map((stroke) => stroke.id);
            expect(new Set(strokeIds).size, `maps.${id} has duplicate stroke ids`).toBe(strokeIds.length);
        }
    });

    it('gives every note some text', () => {
        for (const [id, map] of maps) {
            for (const note of map.notes) {
                expect(note.text.trim(), `maps.${id}.notes.${note.id}`).not.toBe('');
            }
        }
    });

    /** `points` is flat `[x, y, …]`, so an odd length means a coordinate was lost. */
    it('stores stroke points as complete x,y pairs', () => {
        for (const [id, map] of maps) {
            for (const stroke of map.strokes) {
                expect(stroke.points.length % 2, `maps.${id}.strokes.${stroke.id} has a dangling coordinate`).toBe(0);
                expect(stroke.points.length, `maps.${id}.strokes.${stroke.id} is empty`).toBeGreaterThanOrEqual(4);
            }
        }
    });

    /**
     * §4.3's first mitigation: coordinates are rounded before they are ever persisted. A
     * fractional coordinate in `data/` means something wrote a stroke without finishing it.
     */
    it('stores stroke coordinates as integers', () => {
        for (const [id, map] of maps) {
            for (const stroke of map.strokes) {
                for (const value of stroke.points) {
                    expect(Number.isInteger(value), `maps.${id}.strokes.${stroke.id} has a fractional coordinate`).toBe(
                        true
                    );
                }
            }
        }
    });

    it('gives every stroke a positive width', () => {
        for (const [id, map] of maps) {
            for (const stroke of map.strokes) {
                expect(stroke.width, `maps.${id}.strokes.${stroke.id}.width`).toBeGreaterThan(0);
            }
        }
    });
});

describe('location shapes', () => {
    it('points every shape at a registered map', () => {
        const ids = Object.keys(register.maps);
        for (const [id, location] of locationsWithShape) {
            expect(ids, `locations.${id}.shape.mapId`).toContain(location.shape!.mapId);
        }
    });

    it('gives every shape at least three points', () => {
        for (const [id, location] of locationsWithShape) {
            expect(location.shape!.points.length, `locations.${id}.shape.points`).toBeGreaterThanOrEqual(3);
        }
    });

    /**
     * The ring is implicitly closed, so a duplicated first-and-last point is a zero-length edge
     * the editor would then offer the author a handle for.
     */
    it('stores every ring open, with no duplicated closing point', () => {
        for (const [id, location] of locationsWithShape) {
            const points = location.shape!.points;
            expect(openRing(points).length, `locations.${id}.shape.points is explicitly closed`).toBe(points.length);
        }
    });

    /** One winding means one spelling per shape, and therefore one diff per real change. */
    it('winds every ring clockwise on canvas', () => {
        for (const [id, location] of locationsWithShape) {
            expect(isClockwise(location.shape!.points), `locations.${id}.shape.points is counter-clockwise`).toBe(true);
        }
    });

    it('encloses a real area', () => {
        for (const [id, location] of locationsWithShape) {
            expect(area(location.shape!.points), `locations.${id}.shape has no area`).toBeGreaterThan(0);
        }
    });

    /** A self-intersecting ring renders with an even-odd hole and its centroid is meaningless. */
    it('does not cross itself', () => {
        for (const [id, location] of locationsWithShape) {
            expect(isSelfIntersecting(location.shape!.points), `locations.${id}.shape crosses itself`).toBe(false);
        }
    });

    it('gives every shape a colour', () => {
        for (const [id, location] of locationsWithShape) {
            expect(location.shape!.color, `locations.${id}.shape.color`).toBeTruthy();
        }
    });
});

describe('chapter layouts', () => {
    /**
     * A layout key that names no passage is harmless — the client drops it and the next save
     * prunes it (§4.4) — but it is still a sign the author renamed a passage and the file has
     * not caught up, so it is worth reporting.
     */
    it('names only registered passages', async () => {
        for (const [chapterId, chapter] of Object.entries(register.chapters)) {
            if (!chapter.layout) continue;

            const loader = register.passages[chapterId as keyof typeof register.passages];
            const module = await loader();
            const known = new Set(Object.keys(module.default as Record<string, unknown>));

            for (const passageId of Object.keys(chapter.layout)) {
                expect(known, `chapters.${chapterId}.layout names unknown passage "${passageId}"`).toContain(passageId);
            }
        }
    });

    it('gives every layout entry finite coordinates', () => {
        for (const [chapterId, chapter] of Object.entries(register.chapters)) {
            for (const [passageId, point] of Object.entries(chapter.layout ?? {})) {
                const position = point as { x: number; y: number };
                expect(
                    Number.isFinite(position.x) && Number.isFinite(position.y),
                    `chapters.${chapterId}.layout.${passageId}`
                ).toBe(true);
            }
        }
    });
});
