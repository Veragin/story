/**
 * "Open in editor" (plan §3, `POST /api/chapters/:id/open`, `POST /api/passages/:id/open`).
 *
 * Files are found by path convention only, no parse:
 *  - chapter `<ch>`                → `data/chapters/<ch>/<ch>.chapter.ts`
 *  - passage `<ch>-<char>-<local>` → `data/chapters/<ch>/<char>.passages/<local>.ts`, or
 *                                    `<local>.<suffix>.ts` (`cool.transition.ts`), the first match
 *                                    in name order
 * and the line is the passage's declaration (`const introPassage`, exported or not) / the first
 * line mentioning `<ch>Chapter` (`export const villageChapter`), else 1.
 *
 * The editor is `code -g <file>:<line>` by default. `VISUALIZER_EDITOR` overrides it: a command
 * line split on spaces, where `{file}` and `{line}` are substituted (`subl {file}:{line}`,
 * `idea --line {line} {file}`); without placeholders `-g <file>:<line>` is appended
 * (`VISUALIZER_EDITOR=code-insiders`). A failed spawn (no `code` in the container) is not an
 * error: the reply says `opened: false` with the file and line so the client can show the path.
 */
import { spawn as nodeSpawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import type { TOpenDto } from '@story/visualizer-protocol';
import { HttpError } from './http/HttpError';
import { readTextOrNull } from './json/atomicWrite';
import type { ProjectRoot } from './project/ProjectRoot';

/** Ids are single path segments made of word characters (plan §2: ids never contain `-`). */
const ID = /^[A-Za-z0-9_]+$/;

export type TResolvedFile = { file: string; line: number };

const firstLineOf = (text: string, needle: RegExp): number => {
    const lines = text.split('\n');
    const k = lines.findIndex((l) => needle.test(l));
    return k < 0 ? 1 : k + 1;
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const resolveChapterFile = async (project: ProjectRoot, chapterId: string): Promise<TResolvedFile> => {
    if (!ID.test(chapterId)) throw HttpError.notFound(`No chapter "${chapterId}"`);
    const file = project.paths.chapterFile(chapterId);
    const text = await readTextOrNull(file);
    if (text === null) throw HttpError.notFound(`No chapter "${chapterId}" (${project.rel(file)} does not exist)`);
    return { file, line: firstLineOf(text, new RegExp(`\\b${escape(chapterId)}Chapter\\b`)) };
};

export const resolvePassageFile = async (project: ProjectRoot, passageId: string): Promise<TResolvedFile> => {
    const parts = passageId.split('-');
    if (parts.length !== 3 || !parts.every((p) => ID.test(p))) {
        throw HttpError.notFound(`No passage "${passageId}" (expected "<chapter>-<character>-<local>")`);
    }
    const [chapterId, characterId, localId] = parts;
    const dir = project.paths.characterPassagesDir(chapterId, characterId);
    const names = await readdir(dir).catch(() => [] as string[]);
    const name = names
        .filter((n) => n === `${localId}.ts` || (n.startsWith(`${localId}.`) && n.endsWith('.ts')))
        .sort((a, b) => a.length - b.length || (a < b ? -1 : 1))[0];
    if (!name) throw HttpError.notFound(`No passage "${passageId}" in ${project.rel(dir)}`);
    const file = path.join(dir, name);
    const text = (await readTextOrNull(file)) ?? '';
    return {
        file,
        line: firstLineOf(text, new RegExp(`\\b(?:const|let|var|function)\\s+${escape(localId)}Passage\\b`)),
    };
};

/** The command line for a file + line, per `VISUALIZER_EDITOR` (default `code`). */
export const editorCommand = (
    file: string,
    line: number,
    editor: string = process.env.VISUALIZER_EDITOR?.trim() || 'code'
): { command: string; args: string[] } => {
    const words = editor.split(/\s+/).filter(Boolean);
    const [command, ...rest] = words.length > 0 ? words : ['code'];
    const templated = rest.some((w) => w.includes('{file}') || w.includes('{line}'));
    const args = templated
        ? rest.map((w) => w.split('{file}').join(file).split('{line}').join(String(line)))
        : [...rest, '-g', `${file}:${line}`];
    return { command, args };
};

export type TSpawn = typeof nodeSpawn;

/** Replaceable in tests. */
export const openDeps: { spawn: TSpawn } = { spawn: nodeSpawn };

/**
 * Start the editor detached and report whether it could be started. Resolves once the process
 * has spawned (`opened: true`) or failed to (`opened: false`, `message`) — never rejects, never
 * waits for the editor to exit.
 */
export const openInEditor = (project: ProjectRoot, { file, line }: TResolvedFile): Promise<TOpenDto> => {
    const rel = project.rel(file);
    const { command, args } = editorCommand(file, line);
    return new Promise<TOpenDto>((resolve) => {
        const fail = (e: unknown) =>
            resolve({
                ok: true,
                opened: false,
                file: rel,
                line,
                message: `Could not start "${command}": ${(e as Error)?.message ?? String(e)}`,
            });
        try {
            const child = openDeps.spawn(command, args, { detached: true, stdio: 'ignore', cwd: project.root });
            child.once('error', fail);
            child.once('spawn', () => {
                child.unref();
                resolve({ ok: true, opened: true, file: rel, line });
            });
        } catch (e) {
            fail(e);
        }
    });
};
