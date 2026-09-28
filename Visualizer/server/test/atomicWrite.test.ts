import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { atomicWrite, readTextOrNull, stringifyJson } from '../src/json/atomicWrite';
import { version } from '../src/events/version';

let dir: string;
beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'atomic-'));
});
afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
});

describe('atomicWrite', () => {
    it('writes, creates parent dirs and leaves no temp file', async () => {
        const file = path.join(dir, 'a/b/c.json');
        await atomicWrite(file, 'one');
        expect(await readFile(file, 'utf8')).toBe('one');
        await atomicWrite(file, 'two');
        expect(await readFile(file, 'utf8')).toBe('two');
        expect(await readdir(path.dirname(file))).toEqual(['c.json']);
    });

    it('never exposes a partial file to a concurrent reader', async () => {
        const file = path.join(dir, 'big.txt');
        const a = 'a'.repeat(2_000_000);
        const b = 'b'.repeat(2_000_000);
        await atomicWrite(file, a);
        let reads = 0;
        let done = false;
        const reader = (async () => {
            while (!done) {
                const text = await readFile(file, 'utf8');
                expect(text === a || text === b).toBe(true);
                reads++;
            }
        })();
        for (let i = 0; i < 10; i++) await atomicWrite(file, i % 2 ? a : b);
        done = true;
        await reader;
        expect(reads).toBeGreaterThan(0);
    });

    it('cleans up its temp file when the rename fails', async () => {
        const target = path.join(dir, 'is-a-dir');
        await mkdir(path.join(target, 'child'), { recursive: true });
        await expect(atomicWrite(target, 'x')).rejects.toThrow();
        expect((await readdir(dir)).sort()).toEqual(['is-a-dir']);
    });

    it('readTextOrNull returns null for a missing file', async () => {
        expect(await readTextOrNull(path.join(dir, 'missing'))).toBeNull();
    });

    it('stringifyJson matches the repo prettier style', () => {
        expect(stringifyJson({ a: [1] })).toBe('{\n    "a": [\n        1\n    ]\n}\n');
    });
});

describe('version', () => {
    it('is a stable content hash', () => {
        expect(version('abc')).toBe(version('abc'));
        expect(version('abc')).toBe(version(Buffer.from('abc')));
        expect(version('abc')).not.toBe(version('abd'));
        expect(version('abc')).toMatch(/^[0-9a-f]{16}$/);
    });

    it('is empty for a missing file and order-sensitive across files', () => {
        expect(version(null)).toBe('');
        expect(version()).toBe('');
        expect(version('a', 'b')).not.toBe(version('b', 'a'));
        expect(version('ab')).not.toBe(version('a', 'b'));
    });
});
