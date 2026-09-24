import { Injectable } from '@nestjs/common';
import { Project, SyntaxKind, type SourceFile, type TypeLiteralNode } from 'ts-morph';
import { SourceFileService } from '../story/SourceFileService';
import { WriterRefusal } from '../writer/TsWriterService';

/**
 * Reads and writes the author's type aliases — the `structure` tab
 * (VISUALIZER_PLAN §5.3, §7 Phase 10, §8 risk 6).
 *
 * ## Why this is the last phase and the most conservative code in the repo
 *
 * Everything else the server writes is *data*: a wrong value makes one location look odd. This
 * writes **types**, and a wrong one makes the whole story fail to compile — including the files
 * the author has not opened and the tests that would have caught it. §8 risk 6 names the
 * mitigation and it is implemented in two halves:
 *
 *  1. **A conservative reader.** Only a type alias initialised with a plain type *literal* is
 *     editable. A mapped type, a conditional type, an intersection, a generic whose parameter
 *     appears in a member's type — anything the reader does not fully understand — comes back
 *     `editable: false` with the reason, and the UI shows that instead of an input. This is the
 *     same principle as §4.5 rule 2: refuse rather than guess.
 *  2. **Typecheck, then roll back.** Every write is followed by a real `tsc --noEmit` over the
 *     repo; if it fails, the previous text is restored and the compiler's own message is
 *     returned. The author never ends up with a story that does not build because of a form.
 *
 * ## What "editable" covers
 *
 * Adding a property, changing a property's type, making one optional, and removing one. Not:
 * renaming a type, changing its type parameters, or editing an interface — each of those has
 * reference-update semantics that a property-level writer cannot honour.
 */

/** A property of a type literal, as the structure tab shows it. */
export type TStructureField = {
    name: string;
    /** The declared type, as source text: `string`, `number`, `TPoint[]`, `'a' | 'b'`. */
    type: string;
    optional: boolean;
    /** The JSDoc above the property, if any — the author's own description of the field. */
    doc: string | null;
};

export type TStructureType = {
    name: string;
    file: string;
    hash: string | null;
    line: number;
    /** Type parameters, as source text. Present so the UI can show `TLocation<L>` honestly. */
    typeParameters: string[];
    fields: TStructureField[];
    editable: boolean;
    /** Why not, when `editable` is false. */
    reason: string | null;
};

/**
 * What a `PUT` may ask for.
 *
 * Flat rather than a discriminated union, because that is what the wire can actually carry: a
 * JSON body is validated field by field, and `class-validator` has no way to say "`type` is
 * required when `action` is `add`". Encoding it as a union here would mean a cast at the
 * controller boundary that asserts something nothing checked. The requirement is enforced in
 * `renderEdits` instead, where it produces a `422` naming the missing field.
 */
export type TStructureEdit = {
    action: 'add' | 'update' | 'remove';
    name: string;
    /** Source text of the declared type. Required for `add`. */
    type?: string;
    optional?: boolean;
    doc?: string;
};

@Injectable()
export class StructureService {
    constructor(private readonly files: SourceFileService) {}

    /** Every type alias in `types/`, editable or not. */
    async list(): Promise<TStructureType[]> {
        const files = await this.files.listFiles('types');
        const types: TStructureType[] = [];

        for (const file of files) {
            types.push(...(await this.readFile(file)));
        }

        return types.sort((a, b) => a.name.localeCompare(b.name));
    }

    async get(name: string): Promise<TStructureType | undefined> {
        return (await this.list()).find((type) => type.name === name);
    }

    /** Reads every type alias declared in one file. */
    private async readFile(file: string): Promise<TStructureType[]> {
        const contents = await this.files.readIfPresent(file);
        if (contents === null) return [];

        const project = new Project({ skipAddingFilesFromTsConfig: true, skipFileDependencyResolution: true });
        const sourceFile = project.createSourceFile(file, contents, { overwrite: true });
        const hash = await this.files.hashOf(file);

        return sourceFile.getTypeAliases().map((alias) => {
            const literal = typeLiteralOf(sourceFile, alias.getName());
            const typeParameters = alias.getTypeParameters().map((parameter) => parameter.getText());

            if (!literal) {
                return {
                    name: alias.getName(),
                    file,
                    hash,
                    line: alias.getStartLineNumber(),
                    typeParameters,
                    fields: [],
                    editable: false,
                    reason: `"${alias.getName()}" is ${describeShape(alias.getTypeNode()?.getKindName())}, not a plain object type. The Visualizer only edits object types it fully understands.`,
                };
            }

            return {
                name: alias.getName(),
                file,
                hash,
                line: alias.getStartLineNumber(),
                typeParameters,
                fields: literal.getProperties().map((property) => ({
                    name: property.getName(),
                    type: property.getTypeNode()?.getText() ?? 'unknown',
                    optional: property.hasQuestionToken(),
                    doc:
                        property
                            .getJsDocs()
                            .map((jsDoc) => jsDoc.getInnerText().trim())
                            .join('\n') || null,
                })),
                editable: true,
                reason: null,
            };
        });
    }

    /**
     * Applies edits to one type alias and returns the new file text — *without* writing it.
     *
     * Separated from the write so the controller can typecheck the candidate text and decide
     * whether to keep it. That ordering is the whole safety argument: nothing reaches disk that
     * has not compiled.
     */
    async renderEdits(name: string, edits: readonly TStructureEdit[]): Promise<{ file: string; text: string }> {
        const type = await this.get(name);
        if (!type) throw new WriterRefusal(`No type alias named "${name}" in types/`, 'types');
        if (!type.editable) throw new WriterRefusal(type.reason ?? `"${name}" is not editable`, type.file);

        const contents = await this.files.read(type.file);
        const project = new Project({ skipAddingFilesFromTsConfig: true, skipFileDependencyResolution: true });
        const sourceFile = project.createSourceFile(type.file, contents, { overwrite: true });

        const literal = typeLiteralOf(sourceFile, name);
        if (!literal) throw new WriterRefusal(`"${name}" is no longer a plain object type`, type.file);

        for (const edit of edits) {
            assertIdentifier(edit.name, type.file);

            const existing = literal.getProperty(edit.name);

            if (edit.action === 'remove') {
                if (!existing) continue;
                existing.remove();
                continue;
            }

            if (edit.action === 'add') {
                if (existing) {
                    throw new WriterRefusal(`"${name}" already has a property called "${edit.name}"`, type.file);
                }
                if (edit.type === undefined) {
                    throw new WriterRefusal(`Adding "${edit.name}" needs a type`, type.file);
                }
                assertTypeText(edit.type, type.file);
                const added = literal.addProperty({
                    name: edit.name,
                    type: edit.type,
                    hasQuestionToken: edit.optional ?? false,
                });
                if (edit.doc) added.addJsDoc({ description: edit.doc });
                continue;
            }

            // update
            if (!existing) throw new WriterRefusal(`"${name}" has no property called "${edit.name}"`, type.file);
            if (edit.type !== undefined) {
                assertTypeText(edit.type, type.file);
                existing.setType(edit.type);
            }
            if (edit.optional !== undefined) existing.setHasQuestionToken(edit.optional);
            if (edit.doc !== undefined) {
                for (const jsDoc of existing.getJsDocs()) jsDoc.remove();
                if (edit.doc) existing.addJsDoc({ description: edit.doc });
            }
        }

        return { file: type.file, text: sourceFile.getFullText() };
    }
}

/** The type literal a named alias is declared as, or `undefined` when it is anything else. */
const typeLiteralOf = (sourceFile: SourceFile, name: string): TypeLiteralNode | undefined => {
    const alias = sourceFile.getTypeAlias(name);
    const node = alias?.getTypeNode();
    return node?.isKind(SyntaxKind.TypeLiteral) ? node : undefined;
};

const describeShape = (kindName: string | undefined): string => {
    switch (kindName) {
        case 'UnionType':
            return 'a union';
        case 'IntersectionType':
            return 'an intersection';
        case 'MappedType':
            return 'a mapped type';
        case 'ConditionalType':
            return 'a conditional type';
        case 'TypeReference':
            return 'an alias of another type';
        case undefined:
            return 'of an unreadable shape';
        default:
            return `a ${kindName}`;
    }
};

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const assertIdentifier = (name: string, file: string): void => {
    if (!IDENTIFIER.test(name)) {
        throw new WriterRefusal(`"${name}" is not a valid property name`, file);
    }
};

/**
 * A crude sanity check on the type text before it is spliced into a file.
 *
 * Not a parser: the real verification is the `tsc` run the controller does afterwards, which
 * catches everything this could and more. This exists to reject the obviously hostile — a
 * closing brace that would end the type early, a semicolon that would start a new statement —
 * before that text is written anywhere, even to a temporary file.
 */
const assertTypeText = (type: string, file: string): void => {
    const trimmed = type.trim();
    if (trimmed.length === 0) throw new WriterRefusal('A field needs a type', file);
    if (trimmed.length > 500) throw new WriterRefusal('That type is too long to have been meant', file);

    const balanced = (open: string, close: string): boolean =>
        [...trimmed].reduce((depth, character) => {
            if (character === open) return depth + 1;
            if (character === close) return depth - 1;
            return depth;
        }, 0) === 0;

    if (!balanced('{', '}') || !balanced('(', ')') || !balanced('[', ']') || !balanced('<', '>')) {
        throw new WriterRefusal(`"${type}" has unbalanced brackets`, file);
    }
    if (/[;]/.test(trimmed)) {
        throw new WriterRefusal(`"${type}" contains a semicolon, which would end the declaration early`, file);
    }
};
