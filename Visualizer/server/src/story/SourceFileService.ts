import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Every filesystem access the server makes goes through this class (VISUALIZER_PLAN §5.1).
 *
 * ## The allowlist is the security boundary
 *
 * The server takes ids from HTTP requests and turns them into paths. That is a path-traversal
 * problem by construction, and the mitigation is that **nothing else in the server is allowed to
 * touch `fs`** — no controller, no writer, no watcher. `resolvePath` is the single chokepoint,
 * and it refuses anything that does not land inside `data/` or `types/`.
 *
 * Three distinct escapes are blocked, and they need three distinct checks:
 *
 *  1. **`..` traversal.** `resolve()` collapses `..` first, then the result is compared against
 *     the allowed roots with `relative()`. Comparing strings with `startsWith` would not do:
 *     `/app/data-secrets` starts with `/app/data`.
 *  2. **Absolute paths.** An id of `/etc/passwd` must not be joined-and-accepted. Rejected
 *     outright rather than silently re-rooted, because silently re-rooting means the caller
 *     never learns their id was wrong.
 *  3. **Symlink escape.** A symlink *inside* `data/` pointing outside it passes both checks
 *     above, since they are string operations on a path that never touched the disk. So the
 *     real path is resolved and re-checked. This is the one an author can create by accident —
 *     `ln -s ~/notes data/notes` — and the one a string-only guard misses.
 *
 * ## Content hashes
 *
 * `hashOf` is what `If-Match` compares (§5.3). It hashes file *content*, not mtime: an editor
 * that rewrites a file with identical bytes must not invalidate an edit the author is part-way
 * through, and mtime granularity is too coarse to be a concurrency token anyway.
 */

/** Folders the server may read and write. Everything else on disk is out of reach. */
const ALLOWED_ROOTS = ['data', 'types'] as const;

export type TAllowedRoot = (typeof ALLOWED_ROOTS)[number];

export class PathNotAllowedError extends Error {
    constructor(requested: string, reason: string) {
        super(`Path "${requested}" is not allowed: ${reason}`);
        this.name = 'PathNotAllowedError';
    }
}

@Injectable()
export class SourceFileService {
    /** Absolute path of the monorepo root, resolved once at construction. */
    readonly repoRoot: string;

    private readonly allowedRoots: string[];

    constructor() {
        this.repoRoot = findRepoRoot();
        this.allowedRoots = ALLOWED_ROOTS.map((root) => resolve(this.repoRoot, root));
    }

    /** The folders this service will touch, absolute. The watcher subscribes to exactly these. */
    get watchRoots(): string[] {
        return [...this.allowedRoots];
    }

    /**
     * Turns a repo-relative path into an absolute one, or throws. The only way to get a path
     * out of this service.
     */
    resolvePath(repoRelative: string): string {
        if (typeof repoRelative !== 'string' || repoRelative.length === 0) {
            throw new PathNotAllowedError(String(repoRelative), 'empty path');
        }
        if (repoRelative.includes('\0')) {
            // A NUL truncates the path at the syscall boundary, so `data/x\0../../etc` would
            // pass every check above and open something else entirely.
            throw new PathNotAllowedError(repoRelative, 'contains a NUL byte');
        }
        if (isAbsolute(repoRelative)) {
            throw new PathNotAllowedError(repoRelative, 'absolute paths are not accepted');
        }

        const absolute = resolve(this.repoRoot, repoRelative);
        if (!this.isInsideAllowedRoot(absolute)) {
            throw new PathNotAllowedError(repoRelative, 'outside data/ and types/');
        }

        // Symlinks are only checkable against something that exists. A path that does not exist
        // yet (a file about to be created) is checked by its nearest existing ancestor, which is
        // the directory it would be created in.
        const existing = nearestExisting(absolute);
        if (existing) {
            const real = realpathSync(existing);
            if (!this.isInsideAllowedRoot(real)) {
                throw new PathNotAllowedError(repoRelative, 'resolves through a symlink to outside data/ and types/');
            }
        }

        return absolute;
    }

    /** Repo-relative form of an absolute path, with forward slashes. The id form on the wire. */
    toRepoRelative(absolute: string): string {
        return relative(this.repoRoot, absolute).split(sep).join('/');
    }

    private isInsideAllowedRoot(absolute: string): boolean {
        return this.allowedRoots.some((root) => {
            const rel = relative(root, absolute);
            // Inside means: not empty-after-`..`, and not climbing out. `relative` returning
            // something starting with `..` is the climb; an absolute result means a different
            // drive/root entirely.
            return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
        });
    }

    async exists(repoRelative: string): Promise<boolean> {
        try {
            const absolute = this.resolvePath(repoRelative);
            const info = await stat(absolute);
            return info.isFile();
        } catch {
            return false;
        }
    }

    async read(repoRelative: string): Promise<string> {
        return await readFile(this.resolvePath(repoRelative), 'utf8');
    }

    /** Reads a file, or `null` when it does not exist. Throws for a disallowed path. */
    async readIfPresent(repoRelative: string): Promise<string | null> {
        const absolute = this.resolvePath(repoRelative);
        try {
            return await readFile(absolute, 'utf8');
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
            throw error;
        }
    }

    async write(repoRelative: string, contents: string): Promise<void> {
        const absolute = this.resolvePath(repoRelative);
        await mkdir(dirname(absolute), { recursive: true });
        await writeFile(absolute, contents, 'utf8');
    }

    /**
     * Deletes a file. Returns whether there was one to delete.
     *
     * Goes through `resolvePath` like everything else, so a `DELETE` request naming
     * `../../../etc/passwd` is refused before `unlink` is ever reached. Directories are not
     * removable through this service at all: recursive deletion driven by an HTTP id is a
     * category of mistake worth making impossible rather than careful.
     */
    async remove(repoRelative: string): Promise<boolean> {
        const absolute = this.resolvePath(repoRelative);
        try {
            const info = await stat(absolute);
            if (!info.isFile()) {
                throw new Error(`"${repoRelative}" is not a file`);
            }
            await unlink(absolute);
            return true;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
            throw error;
        }
    }

    /** Content hash — the `If-Match` token. `null` when the file does not exist. */
    async hashOf(repoRelative: string): Promise<string | null> {
        const contents = await this.readIfPresent(repoRelative);
        return contents === null ? null : hashContents(contents);
    }

    /** Every `.ts` file under a repo-relative directory, recursively, repo-relative. */
    async listFiles(repoRelativeDir: string, extension = '.ts'): Promise<string[]> {
        const absolute = this.resolvePath(repoRelativeDir);
        const found: string[] = [];

        const walk = async (dir: string): Promise<void> => {
            let entries;
            try {
                entries = await readdir(dir, { withFileTypes: true });
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
                throw error;
            }
            for (const entry of entries) {
                const child = resolve(dir, entry.name);
                if (entry.isDirectory()) {
                    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
                    await walk(child);
                } else if (entry.isFile() && entry.name.endsWith(extension)) {
                    found.push(this.toRepoRelative(child));
                }
            }
        };

        await walk(absolute);
        return found.sort();
    }
}

export const hashContents = (contents: string): string =>
    createHash('sha256').update(contents, 'utf8').digest('hex').slice(0, 32);

/**
 * Walks up from this file until it finds the monorepo root.
 *
 * Identified by the root `package.json` declaring `workspaces`, not by a hard-coded number of
 * `..` segments: the server is run from source, so its own depth is the same in dev and in the
 * container, but a hard-coded depth silently breaks the day the folder moves, and it breaks by
 * resolving to the wrong directory rather than by failing.
 */
const findRepoRoot = (): string => {
    let current = dirname(fileURLToPath(import.meta.url));

    for (let i = 0; i < 12; i++) {
        const candidate = resolve(current, 'package.json');
        if (existsSync(candidate)) {
            try {
                const parsed = JSON.parse(readFileSync(candidate, 'utf8')) as { workspaces?: unknown };
                if (parsed.workspaces) return current;
            } catch {
                /* not the root; keep climbing */
            }
        }
        const parent = dirname(current);
        if (parent === current) break;
        current = parent;
    }

    throw new Error('Could not locate the monorepo root (no package.json with "workspaces" above the server)');
};

/** Nearest ancestor of `absolute` that exists on disk, including itself. `null` if none does. */
const nearestExisting = (absolute: string): string | null => {
    let current = absolute;
    for (let i = 0; i < 64; i++) {
        if (existsSync(current)) return current;
        const parent = dirname(current);
        if (parent === current) return null;
        current = parent;
    }
    return null;
};
