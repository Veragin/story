import path from 'node:path';
import { Project } from 'ts-morph';
import { passageLocalId, passageSource } from '../project/story';

/** Scratch parser for changed passage files: no disk, no type checking, only the syntax tree. */
let scratch: Project | null = null;

/**
 * The local id of a passage file with these contents: its `id` literal, else the file name —
 * the same rule as `passageLocalId`, so the event id matches the id the resource is served under.
 */
export const passageLocalIdOf = (abs: string, contents: string): string => {
    scratch ??= new Project({ useInMemoryFileSystem: true, skipFileDependencyResolution: true });
    const sf = scratch.createSourceFile(path.basename(abs), contents, { overwrite: true });
    try {
        return passageLocalId(passageSource(sf), sf);
    } finally {
        scratch.removeSourceFile(sf);
    }
};
