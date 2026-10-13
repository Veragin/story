import path from 'node:path';
import type { SourceFile } from 'ts-morph';
import { ensureTypeImport, relativeModule } from './ast';
import type { SourceProject } from './SourceProject';

const declaringFile = (sp: SourceProject, typeName: string): SourceFile | undefined =>
    sp.storyFiles().find((sf) => sf.getTypeAlias(typeName)?.isExported());

const isUnder = (dir: string, abs: string) => abs.startsWith(dir + path.sep);

const moduleFor = (sp: SourceProject, fromFile: string, declFile: string): string => {
    const { typesDir, dataDir } = sp.root;
    if (isUnder(typesDir, declFile))
        return isUnder(typesDir, fromFile) ? relativeModule(fromFile, declFile) : '@story/types';
    if (isUnder(dataDir, fromFile)) return relativeModule(fromFile, declFile);
    return `@story/data/${path.relative(dataDir, declFile).split(path.sep).join('/').replace(/\.ts$/, '')}`;
};

/** Adds an `import type` for each name declared in another story file. */
export const ensureTypeImports = (sp: SourceProject, sf: SourceFile, typeNames: string[]) => {
    for (const name of typeNames) {
        const decl = declaringFile(sp, name);
        if (!decl || decl === sf) continue;
        ensureTypeImport(sf, name, moduleFor(sp, sf.getFilePath(), decl.getFilePath()));
    }
};
