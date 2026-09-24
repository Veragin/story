import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'node:child_process';
import { SourceFileService } from '../story/SourceFileService';

/**
 * Opens a file in the author's editor — what every `POST …/open` route ends in
 * (VISUALIZER_PLAN §5.1 `editor/`, §5.3).
 *
 * ## Why `spawn` with an argument array, and never a shell
 *
 * The file path is derived from an id that arrived over HTTP. Building a command string and
 * handing it to a shell would make `POST /api/location/x;rm -rf ~/open` a working request.
 * `spawn(command, args)` with no `shell` option passes the arguments to `execve` directly, so
 * there is no shell to interpret them — and the path has already been through
 * `SourceFileService`'s allowlist before it gets here.
 *
 * ## Failure is not an error
 *
 * The server frequently runs where the author's editor does not: in the dev container, `code`
 * is usually absent. A missing editor is logged and reported as `false`, not raised as a `500`.
 * Being unable to open VS Code is not a reason for the Visualizer to show an error — the client
 * says "could not open" and the author carries on.
 */
@Injectable()
export class EditorService {
    private readonly logger = new Logger(EditorService.name);

    constructor(private readonly files: SourceFileService) {}

    /**
     * Opens `repoRelativePath` at `line`. Resolves to whether the editor could be launched.
     *
     * `EDITOR_COMMAND` overrides the default `code -g`, because not everyone uses VS Code and
     * the alternative is this file growing a table of editors.
     */
    async open(repoRelativePath: string, line = 1): Promise<boolean> {
        const absolute = this.files.resolvePath(repoRelativePath);
        const target = `${absolute}:${Math.max(1, line)}`;

        const configured = process.env.EDITOR_COMMAND?.trim();
        const [command, ...baseArgs] = configured ? configured.split(/\s+/) : ['code', '-g'];

        return await new Promise<boolean>((resolve) => {
            try {
                const child = spawn(command, [...baseArgs, target], {
                    // Detached and ignored: the editor outlives the request, and leaving its
                    // stdio attached would keep the request's handles open until it exits.
                    detached: true,
                    stdio: 'ignore',
                });

                child.on('error', (error) => {
                    this.logger.warn(`Could not open "${target}" with "${command}": ${error.message}`);
                    resolve(false);
                });

                child.unref();
                // No exit code to wait for — a successful launch is all that can be observed,
                // and `error` above fires synchronously enough for the ENOENT case.
                setTimeout(() => resolve(true), 50);
            } catch (error) {
                this.logger.warn(`Could not open "${target}": ${String(error)}`);
                resolve(false);
            }
        });
    }
}
