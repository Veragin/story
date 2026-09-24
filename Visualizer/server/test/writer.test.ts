import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FormatterService } from '../src/writer/FormatterService';
import { RegisterWriterService } from '../src/writer/RegisterWriterService';
import { TsWriterService, WriteConflict, WriterRefusal, literal, raw } from '../src/writer/TsWriterService';
import { createFixture, type TFixture } from './fixture';

/**
 * The writers (VISUALIZER_PLAN §7, Phase 5: "asserting on the resulting file text — including
 * the refusal cases (§4.5 rule 2)").
 *
 * **These tests assert on text, not on parsed values**, and that is the point. §8 risk 2 is
 * "ts-morph writing files the author also hand-edits", and the scenario that loses work is a
 * writer that re-prints a file and drops a comment, a blank line, or the type alias underneath
 * the export. A test that parsed the result and checked `title === 'x'` would pass while every
 * one of those was destroyed.
 */

let fixture: TFixture;
let writer: TsWriterService;
let formatter: FormatterService;
let registers: RegisterWriterService;

const LOCATION = 'data/locations/village.location.ts';
const MAP = 'data/maps/global.map.ts';
const CHAPTER = 'data/chapters/village/village.chapter.ts';
const PASSAGE = 'data/chapters/village/intro.screen.ts';

const read = async (repoRelative: string): Promise<string> => await readFile(fixture.at(repoRelative), 'utf8');

beforeEach(async () => {
    fixture = await createFixture();
    formatter = new FormatterService(fixture.files);
    writer = new TsWriterService(fixture.files, formatter);
    registers = new RegisterWriterService(fixture.files, formatter);
});

afterEach(async () => {
    await fixture.cleanup();
});

describe('property-level edits (§4.5 rule 2)', () => {
    it('changes only the named property', async () => {
        const before = await read(LOCATION);
        await writer.setProperties(LOCATION, 'villageLocation', [
            { name: 'name', initializer: literal('Riverside Village') },
        ]);
        const after = await read(LOCATION);

        expect(after).toContain("name: 'Riverside Village'");
        expect(after).not.toContain("name: 'Village'");
        // Everything else is byte-identical.
        expect(after.replace("name: 'Riverside Village'", "name: 'Village'")).toBe(before);
    });

    it('preserves comments', async () => {
        await writer.setProperties(LOCATION, 'villageLocation', [{ name: 'name', initializer: literal('X') }]);
        expect(await read(LOCATION)).toContain('/** The village. This comment must survive every write. */');
    });

    it('preserves the type alias after the export', async () => {
        await writer.setProperties(LOCATION, 'villageLocation', [{ name: 'name', initializer: literal('X') }]);
        const after = await read(LOCATION);
        expect(after).toContain('export type TVillageLocationData = {');
        expect(after).toContain('mojePromena: number;');
    });

    it('preserves imports and blank lines', async () => {
        await writer.setProperties(LOCATION, 'villageLocation', [{ name: 'name', initializer: literal('X') }]);
        const after = await read(LOCATION);
        expect(after).toContain("import { TLocation } from '@story/types';");
        expect(after).toContain('\n\n    localCharacters: [],');
    });

    it('appends a property that is missing', async () => {
        await writer.setProperties('data/locations/kingdom.location.ts', 'kingdomLocation', [
            {
                name: 'shape',
                initializer: literal({
                    mapId: 'global',
                    points: [
                        { x: 0, y: 0 },
                        { x: 10, y: 0 },
                        { x: 10, y: 10 },
                    ],
                    color: '#c9a227',
                }),
            },
        ]);

        const after = await read('data/locations/kingdom.location.ts');
        expect(after).toContain('shape: {');
        expect(after).toContain("mapId: 'global'");
        expect(after).toContain('init: {}');
    });

    it('removes a property when the initializer is undefined', async () => {
        await writer.setProperties(LOCATION, 'villageLocation', [{ name: 'shape', initializer: undefined }]);
        const after = await read(LOCATION);
        expect(after).not.toContain('shape:');
        expect(after).toContain("name: 'Village'");
    });

    it('applies several edits in one write', async () => {
        const result = await writer.setProperties(LOCATION, 'villageLocation', [
            { name: 'name', initializer: literal('A') },
            { name: 'description', initializer: literal('B') },
        ]);

        expect(result.changed).toEqual(['name', 'description']);
        const after = await read(LOCATION);
        expect(after).toContain("name: 'A'");
        expect(after).toContain("description: 'B'");
    });

    /** Saving an unmodified form must not rewrite the file, or every open tab sees a change. */
    it('reports a no-op edit without touching the file', async () => {
        const before = await read(LOCATION);
        const result = await writer.setProperties(LOCATION, 'villageLocation', [
            { name: 'name', initializer: literal('Village') },
        ]);

        expect(result.changed).toEqual([]);
        expect(await read(LOCATION)).toBe(before);
    });

    it('writes raw source through unescaped, for values that need a call', async () => {
        await writer.setProperties(CHAPTER, 'villageChapter', [
            {
                name: 'timeRange',
                initializer: literal({ start: raw('Time.fromS(100)'), end: raw('Time.fromS(200)') }),
            },
        ]);

        const after = await read(CHAPTER);
        expect(after).toContain('start: Time.fromS(100)');
        expect(after).toContain('end: Time.fromS(200)');
        expect(after).not.toContain("'Time.fromS(100)'");
    });

    it('reads a property back as source text', async () => {
        expect(await writer.readProperty(LOCATION, 'villageLocation', 'name')).toBe("'Village'");
        expect(await writer.readProperty(LOCATION, 'villageLocation', 'nope')).toBeNull();
    });
});

describe('formatting (§4.5 rule 1)', () => {
    /**
     * The rule: a file the server touched is byte-identical to what `yarn pretty` would produce.
     * Otherwise the next `pretty` run turns every author edit into a diff war.
     */
    it('leaves the file already formatted', async () => {
        await writer.setProperties(MAP, 'globalMap', [
            {
                name: 'strokes',
                initializer: literal([
                    { id: 'a', color: '#fff', width: 4, points: [0, 0, 10, 10, 20, 5, 30, 40, 50, 60, 70, 80] },
                ]),
            },
        ]);

        const after = await read(MAP);
        expect(await formatter.isFormatted(after, MAP)).toBe(true);
    });

    /**
     * `.prettierrc` sets `printWidth: 80` at the top level and overrides it to 120 for
     * `*.ts`/`*.js`. Resolving the config from the *file path* is what applies that override;
     * resolving it once, path-less, would wrap every generated line 40 characters early.
     *
     * The assertion is a stroke that fits on one line at 120 and would be exploded onto seven
     * lines at 80 — so a regression here is visible rather than cosmetic.
     */
    it('honours the .ts printWidth override', async () => {
        await writer.setProperties(MAP, 'globalMap', [
            {
                name: 'strokes',
                initializer: literal([
                    { id: 'a', color: '#ffffff', width: 4, points: [0, 0, 10, 10, 20, 20, 30, 30, 40, 40] },
                ]),
            },
        ]);

        const after = await read(MAP);
        const line = after.split('\n').find((candidate) => candidate.includes('points:'));
        expect(line).toBeDefined();
        expect(line!.length).toBeGreaterThan(80);
        expect(line).toContain("id: 'a'");
    });

    it('uses single quotes, matching the repo config', async () => {
        await writer.setProperties(MAP, 'globalMap', [{ name: 'title', initializer: literal('Quoted') }]);
        expect(await read(MAP)).toContain("title: 'Quoted'");
    });

    /**
     * The writer emits `'it\'s\nhere'`; Prettier then rewrites it to `"it's\nhere"`, because
     * `singleQuote` means *prefer* single quotes, not use them when they cost more escapes.
     * What matters is that the value survives and the result is what `yarn pretty` produces —
     * which is exactly the point of running the output through the repo's own formatter rather
     * than trusting the writer's own quoting.
     */
    it('escapes a string so the value survives the round trip', async () => {
        await writer.setProperties(MAP, 'globalMap', [{ name: 'title', initializer: literal("it's\nhere") }]);
        const after = await read(MAP);

        expect(after).toContain('title: "it\'s\\nhere"');
        expect(await formatter.isFormatted(after, MAP)).toBe(true);
        expect(await writer.readProperty(MAP, 'globalMap', 'title')).toBe('"it\'s\\nhere"');
    });

    it('escapes a backslash', async () => {
        await writer.setProperties(MAP, 'globalMap', [{ name: 'title', initializer: literal('a\\b') }]);
        expect(await writer.readProperty(MAP, 'globalMap', 'title')).toBe("'a\\\\b'");
    });
});

describe('refusals (§4.5 rule 2)', () => {
    /** The named case: a passage is a function, and rewriting one loses the author's logic. */
    it('refuses to edit a passage, because it is a function', async () => {
        await expect(
            writer.setProperties(PASSAGE, 'introPassage', [{ name: 'title', initializer: literal('X') }])
        ).rejects.toThrow(WriterRefusal);

        await expect(
            writer.setProperties(PASSAGE, 'introPassage', [{ name: 'title', initializer: literal('X') }])
        ).rejects.toThrow(/function/i);
    });

    it('leaves the passage file untouched when it refuses', async () => {
        const before = await read(PASSAGE);
        await expect(
            writer.setProperties(PASSAGE, 'introPassage', [{ name: 'title', initializer: literal('X') }])
        ).rejects.toThrow();
        expect(await read(PASSAGE)).toBe(before);
    });

    it('refuses when the named export does not exist', async () => {
        await expect(
            writer.setProperties(LOCATION, 'nopeLocation', [{ name: 'name', initializer: literal('X') }])
        ).rejects.toThrow(/has no exported "nopeLocation"/);
    });

    it('refuses when the file does not exist', async () => {
        await expect(writer.setProperties('data/locations/ghost.location.ts', 'ghostLocation', [])).rejects.toThrow(
            /does not exist/
        );
    });

    it('refuses a path outside data/ and types/', async () => {
        await expect(writer.setProperties('../package.json', 'x', [])).rejects.toThrow(/not allowed/);
    });

    it('refuses to overwrite an existing file through createFile', async () => {
        await expect(writer.createFile(LOCATION, 'export const x = 1;\n')).rejects.toThrow(/already exists/);
    });

    it('creates a new file, formatted', async () => {
        const result = await writer.createFile(
            'data/maps/second.map.ts',
            `import {TMap} from '@story/types';\nexport const secondMap:TMap<'second'>={id:'second',title:'Second',size:{width:10,height:10},notes:[],strokes:[]};\n`
        );

        const after = await read('data/maps/second.map.ts');
        expect(result.changed).toEqual(['*']);
        expect(after).toContain("id: 'second'");
        expect(await formatter.isFormatted(after, 'data/maps/second.map.ts')).toBe(true);
    });
});

describe('optimistic concurrency (§5.3)', () => {
    it('accepts a write whose If-Match is current', async () => {
        const hash = await fixture.files.hashOf(LOCATION);
        await expect(
            writer.setProperties(LOCATION, 'villageLocation', [{ name: 'name', initializer: literal('X') }], hash)
        ).resolves.toBeDefined();
    });

    it('rejects a write whose If-Match is stale', async () => {
        const stale = await fixture.files.hashOf(LOCATION);
        await writer.setProperties(LOCATION, 'villageLocation', [{ name: 'name', initializer: literal('First') }]);

        await expect(
            writer.setProperties(LOCATION, 'villageLocation', [{ name: 'name', initializer: literal('Second') }], stale)
        ).rejects.toThrow(WriteConflict);

        // And the losing write did not land.
        expect(await read(LOCATION)).toContain("name: 'First'");
    });

    it('carries both hashes on the conflict, so the client can tell what happened', async () => {
        const stale = await fixture.files.hashOf(LOCATION);
        await writer.setProperties(LOCATION, 'villageLocation', [{ name: 'name', initializer: literal('First') }]);

        const error = await writer
            .setProperties(LOCATION, 'villageLocation', [{ name: 'name', initializer: literal('Second') }], stale)
            .catch((caught: unknown) => caught as WriteConflict);

        expect(error).toBeInstanceOf(WriteConflict);
        expect((error as WriteConflict).expected).toBe(stale);
        expect((error as WriteConflict).actual).not.toBe(stale);
    });

    it('skips the check when no If-Match is sent', async () => {
        await expect(
            writer.setProperties(LOCATION, 'villageLocation', [{ name: 'name', initializer: literal('X') }], undefined)
        ).resolves.toBeDefined();
    });

    it('returns the new hash, which is what the next write must send', async () => {
        const first = await writer.setProperties(LOCATION, 'villageLocation', [
            { name: 'name', initializer: literal('One') },
        ]);
        await expect(
            writer.setProperties(
                LOCATION,
                'villageLocation',
                [{ name: 'name', initializer: literal('Two') }],
                first.hash
            )
        ).resolves.toBeDefined();
    });

    /** A rewrite with identical bytes must not invalidate an edit in flight. */
    it('does not change the hash when nothing changed', async () => {
        const before = await fixture.files.hashOf(LOCATION);
        await writer.setProperties(LOCATION, 'villageLocation', [{ name: 'name', initializer: literal('Village') }]);
        expect(await fixture.files.hashOf(LOCATION)).toBe(before);
    });
});

describe('register edits', () => {
    it('removes an entry and its now-unused import', async () => {
        const symbol = await registers.removeEntry('locations', 'kingdom');
        const after = await read('data/register.ts');

        expect(symbol).toBe('kingdomLocation');
        expect(after).not.toContain('kingdom: kingdomLocation');
        expect(after).not.toContain("from './locations/kingdom.location'");
        // The others are untouched.
        expect(after).toContain('village: villageLocation');
        expect(after).toContain("import { villageLocation } from './locations/village.location';");
    });

    it('keeps an import that something else still uses', async () => {
        // Give the symbol a second use before removing one of them.
        const contents = (await read('data/register.ts')).replace(
            'locations: {',
            'locations: {\n        villageCopy: villageLocation,'
        );
        await fixture.files.write('data/register.ts', contents);

        await registers.removeEntry('locations', 'village');
        const after = await read('data/register.ts');

        expect(after).not.toContain('village: villageLocation');
        expect(after).toContain('villageCopy: villageLocation');
        expect(after).toContain("import { villageLocation } from './locations/village.location';");
    });

    it('treats a missing entry as nothing to do, not as an error', async () => {
        await expect(registers.removeEntry('locations', 'ghost')).resolves.toBeNull();
    });

    it('adds an entry and its import', async () => {
        await registers.addEntry('maps', 'second', 'secondMap', './maps/second.map');
        const after = await read('data/register.ts');

        expect(after).toContain('second: secondMap');
        expect(after).toContain("import { secondMap } from './maps/second.map';");
    });

    it('refuses to add an entry that already exists', async () => {
        await expect(registers.addEntry('maps', 'global', 'globalMap', './maps/global.map')).rejects.toThrow(
            /already has/
        );
    });

    it('reports whether an entry exists', async () => {
        expect(await registers.has('maps', 'global')).toBe(true);
        expect(await registers.has('maps', 'nope')).toBe(false);
    });

    it('leaves the register formatted and parseable', async () => {
        await registers.removeEntry('locations', 'kingdom');
        const after = await read('data/register.ts');
        expect(await formatter.isFormatted(after, 'data/register.ts')).toBe(true);
        expect(after).toContain('} as const;');
    });
});

describe('literal rendering', () => {
    it('renders plain data as an author would write it', () => {
        expect(literal('x')).toBe("'x'");
        expect(literal(12)).toBe('12');
        expect(literal(true)).toBe('true');
        expect(literal(null)).toBe('null');
        expect(literal([1, 2])).toBe('[1, 2]');
        expect(literal({ a: 1 })).toBe('{ a: 1 }');
    });

    it('omits undefined properties rather than writing them out', () => {
        expect(literal({ a: 1, b: undefined })).toBe('{ a: 1 }');
    });

    it('quotes keys that are not identifiers', () => {
        expect(literal({ 'village-thomas-intro': { x: 1, y: 2 } })).toBe("{ 'village-thomas-intro': { x: 1, y: 2 } }");
    });

    it('refuses to emit a non-finite number as a number', () => {
        expect(literal(Number.POSITIVE_INFINITY)).toBe('undefined');
        expect(literal(Number.NaN)).toBe('undefined');
    });
});
