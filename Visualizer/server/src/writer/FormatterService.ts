import { Injectable } from '@nestjs/common';
import * as prettier from 'prettier';
import { SourceFileService } from '../story/SourceFileService';

/**
 * Formats generated source with **the repo's own Prettier config** (VISUALIZER_PLAN §4.5 rule 1).
 *
 * The rule it enforces: a file the server touched must be byte-identical to what `yarn pretty`
 * would produce. Without that, the next `pretty` run reformats every line the server wrote, and
 * the author's real change is buried in a whitespace diff — §4.5 calls this "a diff war", and it
 * is the failure that makes a code-writing server unusable rather than merely imperfect.
 *
 * Two things make it hold:
 *
 *  1. **The config is resolved from the target file's path**, not hard-coded. `.prettierrc` has
 *     `overrides` keyed by extension — `printWidth` is 80 by default and 120 for `.ts`/`.js` —
 *     so formatting with the top-level options alone would wrap every generated line 40
 *     characters early. `resolveConfig(filePath)` applies the overrides the same way the CLI does.
 *  2. **The config is cached, not re-read per call.** `resolveConfig` walks the directory tree
 *     and parses the file; doing that on every property write would dominate the cost of a save.
 */
@Injectable()
export class FormatterService {
    private cached: prettier.Options | null = null;
    private cachedForFile: string | null = null;

    constructor(private readonly files: SourceFileService) {}

    /**
     * Formats TypeScript source as `yarn pretty` would for `repoRelativeFile`.
     *
     * A file that Prettier cannot parse is returned **unchanged** rather than throwing. The
     * caller is about to write it either way, and a ts-morph edit that produced unparseable
     * output is a bug worth seeing in the file, not one worth hiding behind a 500 that leaves
     * the author's change lost.
     */
    async format(source: string, repoRelativeFile: string): Promise<string> {
        const options = await this.optionsFor(repoRelativeFile);
        try {
            return await prettier.format(source, { ...options, parser: 'typescript' });
        } catch {
            return source;
        }
    }

    /** True when `source` is already formatted — used by the tests to assert rule 1 directly. */
    async isFormatted(source: string, repoRelativeFile: string): Promise<boolean> {
        return (await this.format(source, repoRelativeFile)) === source;
    }

    private async optionsFor(repoRelativeFile: string): Promise<prettier.Options> {
        if (this.cached && this.cachedForFile === repoRelativeFile) return this.cached;

        const absolute = this.files.resolvePath(repoRelativeFile);
        const resolved = (await prettier.resolveConfig(absolute)) ?? {};

        this.cached = resolved;
        this.cachedForFile = repoRelativeFile;
        return resolved;
    }
}
