import path from 'node:path';
import { Project } from 'ts-morph';
import { passageLocalId, passageSource } from '../project/story';

let scratch: Project | null = null;

export const passageLocalIdOf = (abs: string, contents: string): string => {
    scratch ??= new Project({ useInMemoryFileSystem: true, skipFileDependencyResolution: true });
    const sf = scratch.createSourceFile(path.basename(abs), contents, { overwrite: true });
    try {
        return passageLocalId(passageSource(sf), sf);
    } finally {
        scratch.removeSourceFile(sf);
    }
};
