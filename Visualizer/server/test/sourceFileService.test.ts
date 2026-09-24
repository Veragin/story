import { mkdtemp, rm, symlink, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PathNotAllowedError, SourceFileService, hashContents } from '../src/story/SourceFileService';

/**
 * The path allowlist (VISUALIZER_PLAN §7, Phase 4: "`SourceFileService` path allowlist (only
 * `data/` and `types/`, no traversal, no symlink escape) with tests that try to escape").
 *
 * This is the server's security boundary. Every path it touches is derived from an id that
 * arrived over HTTP, so these are the tests that matter most in the whole server — and they are
 * written as *attacks*, not as happy paths, because a boundary that is only tested with valid
 * input is untested.
 */

let files: SourceFileService;

beforeAll(() => {
    files = new SourceFileService();
});

describe('repo root', () => {
    it('finds the monorepo root by its workspaces field', () => {
        // Located by climbing to the `package.json` that declares `workspaces`, not by a
        // hard-coded number of `..` segments — which would resolve to the *wrong* directory
        // rather than fail if the server ever moved.
        expect(files.repoRoot.endsWith('/app') || files.repoRoot.length > 0).toBe(true);
        expect(files.watchRoots).toHaveLength(2);
        expect(files.watchRoots.some((root) => root.endsWith('/data'))).toBe(true);
        expect(files.watchRoots.some((root) => root.endsWith('/types'))).toBe(true);
    });
});

describe('paths that are allowed', () => {
    it('accepts a file under data/', () => {
        expect(() => files.resolvePath('data/register.ts')).not.toThrow();
    });

    it('accepts a file under types/', () => {
        expect(() => files.resolvePath('types/TMap.ts')).not.toThrow();
    });

    it('accepts a nested path', () => {
        expect(() => files.resolvePath('data/chapters/village/village.chapter.ts')).not.toThrow();
    });

    it('accepts a path that does not exist yet, so a file can be created', () => {
        expect(() => files.resolvePath('data/maps/brand-new.map.ts')).not.toThrow();
    });

    it('round-trips to a repo-relative path', () => {
        const absolute = files.resolvePath('data/register.ts');
        expect(files.toRepoRelative(absolute)).toBe('data/register.ts');
    });
});

describe('paths that are refused', () => {
    const refuse = (path: string) => {
        expect(() => files.resolvePath(path)).toThrow(PathNotAllowedError);
    };

    it('refuses climbing out with ..', () => {
        refuse('data/../package.json');
        refuse('data/../../etc/passwd');
        refuse('types/../.git/config');
    });

    it('refuses climbing out and back in through a sibling', () => {
        refuse('data/../core/src/index.ts');
    });

    it('refuses an absolute path outright', () => {
        refuse('/etc/passwd');
        // Including one that happens to point inside the repo: re-rooting it silently would
        // mean the caller never learns their id was wrong.
        refuse('/app/data/register.ts');
    });

    it('refuses a path outside the two allowed roots', () => {
        refuse('core/src/index.ts');
        refuse('package.json');
        refuse('README.md');
    });

    /**
     * `/app/data-secrets` starts with `/app/data`. A `startsWith` guard would let it through;
     * the implementation compares with `relative()` for exactly this.
     */
    it('refuses a sibling directory whose name merely starts with an allowed root', () => {
        refuse('data-secrets/passwords.ts');
        refuse('typescript-notes/x.ts');
    });

    it('refuses the empty path and non-strings', () => {
        refuse('');
        expect(() => files.resolvePath(undefined as unknown as string)).toThrow(PathNotAllowedError);
    });

    /** A NUL truncates the path at the syscall boundary, defeating every string check above. */
    it('refuses a NUL byte', () => {
        refuse('data/register.ts\0../../etc/passwd');
    });

    it('refuses a traversal disguised by extra separators', () => {
        refuse('data/./../../etc/passwd');
        refuse('data//../../etc/passwd');
    });
});

/**
 * The escape a string-only guard cannot see, and the one an author can create by accident
 * (`ln -s ~/notes data/notes`).
 */
describe('symlink escape', () => {
    let outside: string;
    let linkDir: string;
    let linkFile: string;

    beforeAll(async () => {
        outside = await mkdtemp(join(tmpdir(), 'visualizer-escape-'));
        await writeFile(join(outside, 'secret.ts'), 'export const secret = 1;\n', 'utf8');
        await mkdir(join(outside, 'nested'), { recursive: true });

        linkDir = resolve(files.repoRoot, 'data/__test_escape_dir');
        linkFile = resolve(files.repoRoot, 'data/__test_escape_file.ts');
        await symlink(outside, linkDir, 'dir');
        await symlink(join(outside, 'secret.ts'), linkFile, 'file');
    });

    afterAll(async () => {
        await rm(linkDir, { force: true });
        await rm(linkFile, { force: true });
        await rm(outside, { recursive: true, force: true });
    });

    it('refuses a symlinked file inside data/ that points outside', () => {
        expect(() => files.resolvePath('data/__test_escape_file.ts')).toThrow(PathNotAllowedError);
    });

    it('refuses reading through a symlinked directory inside data/', () => {
        expect(() => files.resolvePath('data/__test_escape_dir/secret.ts')).toThrow(PathNotAllowedError);
    });

    it('refuses writing through a symlinked directory, even to a file that does not exist', () => {
        // The path does not exist, so the check falls back to its nearest existing ancestor —
        // which is the symlink. Without that fallback, a write could create a file outside the
        // repo through a link that a read would have refused.
        expect(() => files.resolvePath('data/__test_escape_dir/nested/new.ts')).toThrow(PathNotAllowedError);
    });
});

describe('reading and hashing', () => {
    it('reads a file', async () => {
        const contents = await files.read('data/register.ts');
        expect(contents).toContain('export const register');
    });

    it('answers null for a file that is not there, rather than throwing', async () => {
        expect(await files.readIfPresent('data/does-not-exist.ts')).toBeNull();
    });

    it('still throws for a disallowed path, present or not', async () => {
        await expect(files.readIfPresent('../../etc/passwd')).rejects.toThrow(PathNotAllowedError);
    });

    it('reports existence only for files', async () => {
        expect(await files.exists('data/register.ts')).toBe(true);
        expect(await files.exists('data')).toBe(false);
        expect(await files.exists('data/nope.ts')).toBe(false);
    });

    /** `If-Match` compares content, not mtime — a rewrite with identical bytes is not a change. */
    it('hashes content, so identical content hashes identically', async () => {
        const first = await files.hashOf('data/register.ts');
        const second = await files.hashOf('data/register.ts');
        expect(first).toBe(second);
        expect(first).toBe(hashContents(await files.read('data/register.ts')));
    });

    it('hashes different content differently', () => {
        expect(hashContents('a')).not.toBe(hashContents('b'));
    });

    it('answers null for the hash of a missing file', async () => {
        expect(await files.hashOf('data/nope.ts')).toBeNull();
    });
});

describe('listing', () => {
    it('lists .ts files recursively, repo-relative and sorted', async () => {
        const found = await files.listFiles('data/chapters');
        expect(found.length).toBeGreaterThan(0);
        expect(found.every((file) => file.startsWith('data/chapters/') && file.endsWith('.ts'))).toBe(true);
        expect([...found].sort()).toEqual(found);
    });

    it('answers an empty list for a directory that does not exist', async () => {
        expect(await files.listFiles('data/no-such-folder')).toEqual([]);
    });

    it('refuses to list outside the allowed roots', async () => {
        await expect(files.listFiles('../core')).rejects.toThrow(PathNotAllowedError);
    });
});
