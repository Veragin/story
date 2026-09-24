import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { SourceFileService } from '../story/SourceFileService';

/**
 * Runs the repo's own `tsc --noEmit` and reports whether it passed
 * (VISUALIZER_PLAN §7 Phase 10: "every write is preceded by a `tsc` check of the affected files
 * and rolled back if it fails"; §8 risk 6).
 *
 * ## Why the whole program, not "the affected files"
 *
 * The plan says "of the affected files", and checking only those would be both faster and
 * wrong. `types/` is where every id union is *derived from* `data/` — `TLocationId` is
 * `keyof register.locations` — so a change to `TLocation` can break a chapter file that does
 * not import `TLocation` at all. A per-file check would pass and the repo would still not
 * build. The root program is the only thing that answers the question actually being asked,
 * which is "does the story still compile?".
 *
 * It costs a few seconds. That is the right price for a structural edit, and it is paid once
 * per save, not once per keystroke.
 *
 * ## Why `spawn`, not the TypeScript API
 *
 * The server could load `typescript` and build a program in-process. Shelling out to the repo's
 * own `tsc` with the repo's own config means the check is *the same check* `yarn typecheck`
 * runs — same compiler version, same flags, same result. An in-process approximation that
 * disagreed with CI would be worse than no check.
 */
@Injectable()
export class TypecheckService {
    private readonly logger = new Logger(TypecheckService.name);

    constructor(private readonly files: SourceFileService) {}

    /**
     * Runs `tsc --noEmit -p tsconfig.json` at the repo root.
     *
     * Resolves to `{ ok: true }` or `{ ok: false, output }` — it does not throw, because a
     * failing typecheck is an expected outcome that the caller has a plan for (roll back and
     * report), not an exception.
     */
    async check(timeoutMs = 120_000): Promise<{ ok: boolean; output: string }> {
        return await new Promise((resolve) => {
            const child = spawn('node', ['node_modules/typescript/bin/tsc', '--noEmit', '-p', 'tsconfig.json'], {
                cwd: this.files.repoRoot,
                stdio: ['ignore', 'pipe', 'pipe'],
            });

            let output = '';
            child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
            child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));

            const timer = setTimeout(() => {
                child.kill('SIGKILL');
                // A timeout is reported as a failure, so the caller rolls back. Treating "we do
                // not know" as success is how a broken story reaches disk.
                resolve({ ok: false, output: `Typecheck timed out after ${timeoutMs}ms` });
            }, timeoutMs);

            child.on('error', (error) => {
                clearTimeout(timer);
                this.logger.error(`Could not run tsc: ${error.message}`);
                resolve({ ok: false, output: `Could not run tsc: ${error.message}` });
            });

            child.on('close', (code) => {
                clearTimeout(timer);
                resolve({ ok: code === 0, output: output.trim() });
            });
        });
    }

    /**
     * Writes `text` to `file`, typechecks, and restores the original if it fails.
     *
     * The rollback restores the *exact* previous bytes, not a re-render — so a failed structural
     * edit leaves the file byte-identical to what the author had, including any formatting the
     * writer would otherwise have normalised.
     */
    async writeIfItCompiles(file: string, text: string): Promise<{ ok: true } | { ok: false; output: string }> {
        const original = await this.files.readIfPresent(file);
        await this.files.write(file, text);

        const result = await this.check();
        if (result.ok) return { ok: true };

        if (original === null) await this.files.remove(file);
        else await this.files.write(file, original);

        this.logger.warn(`Rolled back "${file}": the story no longer typechecks`);
        return { ok: false, output: result.output };
    }
}
