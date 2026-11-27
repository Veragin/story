import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ProjectRoot } from '../../src/project/ProjectRoot';

export const fixtureDir = (name: string) => path.join(import.meta.dirname, '..', 'fixtures', name);

// story-relative paths of a fixture folder, whose files are the story files plus `.txt`
export const fixtureFiles = async (dir: string, sub = dir): Promise<string[]> => {
    const out: string[] = [];
    for (const e of await readdir(sub, { withFileTypes: true })) {
        const full = path.join(sub, e.name);
        if (e.isDirectory()) out.push(...(await fixtureFiles(dir, full)));
        else out.push(path.relative(dir, full).replace(/\.txt$/, ''));
    }
    return out.sort();
};

export const writeFixture = async (project: ProjectRoot, dir: string) => {
    for (const file of await fixtureFiles(dir)) {
        await writeFile(project.abs(file), await readFile(path.join(dir, `${file}.txt`), 'utf8'));
    }
};

export const CLASS_FILES = ['types/Character.ts', 'types/Npc.ts', 'types/Location.ts'];

// the example story as it was while `TCharacter` / `TNpc` / `TLocation` were types
export const toPreClassLayout = async (project: ProjectRoot) => {
    await writeFixture(project, fixtureDir('preClassLayout'));
    for (const file of CLASS_FILES) await rm(project.abs(file));
};
