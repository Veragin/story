import { Injectable } from '@nestjs/common';
import { Project, SyntaxKind, type ObjectLiteralExpression, type SourceFile } from 'ts-morph';
import { SourceFileService } from '../story/SourceFileService';
import { FormatterService } from './FormatterService';
import { WriterRefusal } from './TsWriterService';

/**
 * Adds and removes entries in `data/register.ts` (VISUALIZER_PLAN §5.3 `DELETE` routes).
 *
 * The register is the story's index: `TLocationId`, `TChapterId` and `TMapId` are all `keyof`
 * one of its slices, so creating or deleting an entity is *two* edits — the file, and the entry
 * that makes the id exist. Doing only the first leaves a story that does not typecheck, which
 * is the failure mode this class exists to prevent.
 *
 * Deleting an entry also removes its `import`, and that is the part worth being careful about:
 * an orphaned import of a file that no longer exists is a hard module-resolution error at boot,
 * not a lint warning. The import is only removed when *no other* reference to the symbol
 * survives, so a location that is also referenced from a chapter does not break.
 *
 * Same rules as `TsWriterService`: property-level edits, never a re-print, refuse rather than
 * guess (§4.5).
 */

const REGISTER_FILE = 'data/register.ts';
const REGISTER_EXPORT = 'register';

/** The register slices this service will touch. Anything else is refused. */
export type TRegisterSlice = 'chapters' | 'locations' | 'maps' | 'characters' | 'sideCharacters' | 'passages';

@Injectable()
export class RegisterWriterService {
    constructor(
        private readonly files: SourceFileService,
        private readonly formatter: FormatterService
    ) {}

    /** Whether a slice already has an entry under `id`. */
    async has(slice: TRegisterSlice, id: string): Promise<boolean> {
        const { literal } = await this.load();
        return this.sliceOf(literal, slice).getProperty(id) !== undefined;
    }

    /**
     * Adds `slice[id] = symbol` and the import that supplies `symbol`.
     *
     * `importPath` is relative to `data/`, extension-less in the repo's own style
     * (`./maps/global.map`).
     */
    async addEntry(slice: TRegisterSlice, id: string, symbol: string, importPath: string): Promise<void> {
        const { sourceFile, literal } = await this.load();
        const target = this.sliceOf(literal, slice);

        if (target.getProperty(id)) {
            throw new WriterRefusal(`register.${slice} already has "${id}"`, REGISTER_FILE);
        }

        target.addPropertyAssignment({ name: id, initializer: symbol });

        const alreadyImported = sourceFile
            .getImportDeclarations()
            .some((declaration) => declaration.getNamedImports().some((named) => named.getName() === symbol));

        if (!alreadyImported) {
            // Appended rather than inserted alphabetically: the existing imports are in no
            // particular order, and imposing one would rewrite lines the author owns.
            sourceFile.addImportDeclaration({ moduleSpecifier: importPath, namedImports: [symbol] });
        }

        await this.save(sourceFile);
    }

    /**
     * Removes `slice[id]`, and its import when nothing else refers to the symbol.
     *
     * Returns the symbol that was removed, so a caller can report it. A missing entry is *not*
     * an error: deleting an entity whose register entry was already removed by hand should
     * still delete the file.
     */
    async removeEntry(slice: TRegisterSlice, id: string): Promise<string | null> {
        const { sourceFile, literal } = await this.load();
        const target = this.sliceOf(literal, slice);

        const property = target.getProperty(id);
        if (!property) return null;

        if (!property.isKind(SyntaxKind.PropertyAssignment)) {
            throw new WriterRefusal(
                `register.${slice}.${id} is a ${property.getKindName()}, not a plain property — refusing to remove it`,
                REGISTER_FILE
            );
        }

        const symbol = property.getInitializer()?.getText() ?? null;
        property.remove();

        if (symbol && IDENTIFIER.test(symbol)) {
            this.removeImportIfUnused(sourceFile, symbol);
        }

        await this.save(sourceFile);
        return symbol;
    }

    /**
     * Drops the named import for `symbol` when the file no longer mentions it anywhere else.
     *
     * The check counts identifier *occurrences* rather than trusting that removing one property
     * removed the only use: a symbol can legitimately appear in two slices (a location used as
     * both a location and a sublocation), and removing its import then breaks the other one.
     */
    private removeImportIfUnused(sourceFile: SourceFile, symbol: string): void {
        const uses = sourceFile
            .getDescendantsOfKind(SyntaxKind.Identifier)
            .filter((identifier) => identifier.getText() === symbol);

        // One remaining use is the import specifier itself.
        const importSpecifiers = uses.filter((identifier) => identifier.getParentIfKind(SyntaxKind.ImportSpecifier));
        if (uses.length > importSpecifiers.length) return;

        for (const declaration of sourceFile.getImportDeclarations()) {
            const named = declaration.getNamedImports().find((entry) => entry.getName() === symbol);
            if (!named) continue;

            named.remove();
            // An import declaration with nothing left in it would otherwise remain as a
            // side-effect import, which changes what the module does.
            if (declaration.getNamedImports().length === 0 && !declaration.getDefaultImport()) {
                declaration.remove();
            }
            return;
        }
    }

    private async load(): Promise<{ sourceFile: SourceFile; literal: ObjectLiteralExpression }> {
        const contents = await this.files.read(REGISTER_FILE);
        const project = new Project({ skipAddingFilesFromTsConfig: true, skipFileDependencyResolution: true });
        const sourceFile = project.createSourceFile(REGISTER_FILE, contents, { overwrite: true });

        const declaration = sourceFile.getVariableDeclaration(REGISTER_EXPORT);
        if (!declaration) {
            throw new WriterRefusal(`"${REGISTER_FILE}" has no exported "${REGISTER_EXPORT}"`, REGISTER_FILE);
        }

        // `register` is written `{ … } as const`, so the assertion has to be unwrapped before
        // the object literal is reachable.
        let initializer = declaration.getInitializer();
        while (initializer?.isKind(SyntaxKind.AsExpression)) initializer = initializer.getExpression();

        if (!initializer?.isKind(SyntaxKind.ObjectLiteralExpression)) {
            throw new WriterRefusal(`"${REGISTER_EXPORT}" is not an object literal`, REGISTER_FILE);
        }

        return { sourceFile, literal: initializer };
    }

    private sliceOf(literal: ObjectLiteralExpression, slice: TRegisterSlice): ObjectLiteralExpression {
        const property = literal.getProperty(slice);
        if (!property?.isKind(SyntaxKind.PropertyAssignment)) {
            throw new WriterRefusal(`register has no "${slice}" slice`, REGISTER_FILE);
        }

        const initializer = property.getInitializer();
        if (!initializer?.isKind(SyntaxKind.ObjectLiteralExpression)) {
            throw new WriterRefusal(`register.${slice} is not an object literal`, REGISTER_FILE);
        }

        return initializer;
    }

    private async save(sourceFile: SourceFile): Promise<void> {
        const formatted = await this.formatter.format(sourceFile.getFullText(), REGISTER_FILE);
        await this.files.write(REGISTER_FILE, formatted);
    }
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
