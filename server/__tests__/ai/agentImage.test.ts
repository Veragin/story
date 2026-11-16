import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../../src/config/env';
import { enginePaths } from '../../src/project/ProjectRoot';
import { storyTsconfig } from '../../src/stories/storyTsconfig';

const AGENT_DIR = path.join(REPO_ROOT, 'server', 'ai', 'agent');
const IMAGE_REPO = '/repo';
const DEPS_STAGE = 'deps';
const DEPS_ROOT = '/deps';

type TCopy = { from: string | undefined; sources: string[]; dest: string };

const readRepoFile = (...relative: string[]) => readFile(path.join(REPO_ROOT, ...relative), 'utf8');

const instructions = (dockerfile: string): string[] =>
    dockerfile
        .replace(/\\\n/g, ' ')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '' && !line.startsWith('#'));

const parseCopy = (instruction: string): TCopy => {
    const words = instruction.split(/\s+/).slice(1);
    const flags = words.filter((word) => word.startsWith('--'));
    const paths = words.filter((word) => !word.startsWith('--'));
    const from = flags.find((flag) => flag.startsWith('--from='))?.slice('--from='.length);
    return { from, sources: paths.slice(0, -1), dest: paths[paths.length - 1].replace(/\/$/, '') };
};

const dockerfileCopies = async (): Promise<TCopy[]> =>
    instructions(await readRepoFile('docker', 'Dockerfile.ai'))
        .filter((line) => /^COPY\s/i.test(line))
        .map(parseCopy);

const withoutGlob = (entry: string) => entry.replace(/\/\*[^/]*$/, '');

// a source copies `repoRelative` when it is that path (build context) or ends with it (the deps stage)
const sourceMatches = (copy: TCopy, repoRelative: string) =>
    copy.sources.some((source) => {
        const plain = withoutGlob(source);
        return copy.from === DEPS_STAGE ? plain === `${DEPS_ROOT}/${repoRelative}` : plain === repoRelative;
    });

const coveringCopy = (copies: TCopy[], repoRelative: string): TCopy | undefined => {
    const target = `${IMAGE_REPO}/${repoRelative}`;
    return copies.find((copy) => {
        if (target !== copy.dest && !target.startsWith(`${copy.dest}/`)) return false;
        return sourceMatches(copy, copy.dest.slice(IMAGE_REPO.length + 1));
    });
};

const installedVersion = async (pkg: string): Promise<unknown> => {
    const json: unknown = JSON.parse(await readRepoFile('node_modules', pkg, 'package.json'));
    return typeof json === 'object' && json !== null && 'version' in json ? json.version : undefined;
};

const dockerArg = async (name: string): Promise<string | undefined> => {
    const line = instructions(await readRepoFile('docker', 'Dockerfile.ai')).find((l) => l.startsWith(`ARG ${name}=`));
    return line?.slice(`ARG ${name}=`.length);
};

describe('agent image (docker/Dockerfile.ai)', () => {
    it('copies every engine path the story tsconfig points at into /repo', async () => {
        const copies = await dockerfileCopies();
        const entries = Object.values(enginePaths((entry) => entry)).flat();
        expect(entries.length).toBeGreaterThan(0);
        for (const entry of [...entries, 'tsconfig.base.json']) {
            expect(coveringCopy(copies, withoutGlob(entry)), entry).toBeDefined();
        }
    });

    it('installs the type declarations at the versions the repo uses', async () => {
        expect(await dockerArg('TYPES_REACT_VERSION')).toBe(await installedVersion('@types/react'));
        expect(await dockerArg('MUI_ICONS_VERSION')).toBe(await installedVersion('@mui/icons-material'));
    });

    it('bakes the agent tsconfig as the story tsconfig and the config into /opt/agent/claude', async () => {
        const copies = await dockerfileCopies();
        const dests = (source: string) => copies.filter((c) => c.sources.includes(source)).map((c) => c.dest);
        expect(dests('server/ai/agent/tsconfig.json')).toEqual([`${IMAGE_REPO}/stories/story/tsconfig.json`]);
        expect(dests('server/ai/agent/CLAUDE.md')).toEqual(['/opt/agent/claude']);
        expect(dests('server/ai/agent/settings.json')).toEqual(['/opt/agent/claude']);
        expect(dests('server/ai/agent/skills')).toEqual(['/opt/agent/claude/skills']);
    });
});

describe('agent config (server/ai/agent)', () => {
    it('tsconfig.json is the story tsconfig of a story two levels below the repo root', async () => {
        const generated = await storyTsconfig(path.join(REPO_ROOT, 'stories', 'story'));
        const checkedIn = await readFile(path.join(AGENT_DIR, 'tsconfig.json'), 'utf8');
        expect(JSON.parse(checkedIn)).toEqual(JSON.parse(generated));
    });

    it('settings.json denies shell and web access', async () => {
        const settings: unknown = JSON.parse(await readFile(path.join(AGENT_DIR, 'settings.json'), 'utf8'));
        expect(settings).toMatchObject({
            permissions: { deny: expect.arrayContaining(['Bash', 'WebFetch', 'WebSearch']) },
        });
        expect(settings).not.toMatchObject({
            permissions: { allow: expect.arrayContaining(['Bash']) },
        });
    });

    it('every skill has a name and a description in its frontmatter', async () => {
        for (const skill of ['story-files', 'passages', 'entities', 'structure']) {
            const text = await readFile(path.join(AGENT_DIR, 'skills', skill, 'SKILL.md'), 'utf8');
            const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? '';
            expect(frontmatter, skill).toMatch(new RegExp(`^name: ${skill}$`, 'm'));
            expect(frontmatter, skill).toMatch(/^description: \S.+$/m);
        }
    });
});
