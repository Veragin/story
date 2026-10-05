import type {
    TAddLiteralValueBody,
    TCreateLiteralBody,
    TDeleteLiteralBody,
    TLiteralDto,
    TOkDto,
    TReferenceDto,
    TUpdateLiteralBody,
} from '@story/visualizer-protocol';
import { Node, type SourceFile, type StringLiteral, SyntaxKind, type Type, type TypeAliasDeclaration } from 'ts-morph';
import { HttpError } from '../../http/HttpError';
import { lineOf, quote, removeStatement, setUnionMembers } from '../ast';
import { LITERALS_FILE, readLiterals, readStructure } from '../readers/structure';
import { dedupe, diagnosticsAsReferences, referenceAt } from '../registry';
import type { EditSession, SourceProject } from '../SourceProject';
import {
    asBody,
    assertCurrentVersion,
    barrelAdd,
    emitWrittenResources,
    optionalText,
    requireText,
    structureEvent,
    type TWriter,
} from './common';
import { assertStructName, parseLiteralValues, parseRenames } from './structureBody';

const LITERALS_MODULE = './literals';

const findLiteral = (sp: SourceProject, name: string): TLiteralDto => {
    const literal = readLiterals(sp).literals.find((l) => l.name === name);
    if (!literal) throw HttpError.notFound(`No literal "${name}"`);
    return literal;
};

const literalAlias = (sf: SourceFile, name: string): TypeAliasDeclaration => sf.getTypeAliasOrThrow(name);

const unionText = (values: string[]) => values.map(quote).join(' | ');

// `export {};` only made an empty file a module
const removeEmptyExports = (sf: SourceFile) => {
    for (const decl of sf.getExportDeclarations()) {
        if (!decl.hasModuleSpecifier() && decl.getNamedExports().length === 0) removeStatement(decl);
    }
};

const globalLiteralsFile = (s: EditSession): SourceFile => {
    const abs = s.sp.root.abs(LITERALS_FILE);
    if (s.sp.file(abs)) return s.edit(abs);
    barrelAdd(s, LITERALS_MODULE);
    return s.create(abs, '');
};

const localLiteralsFile = (s: EditSession, file: string): SourceFile => {
    const abs = s.sp.root.abs(file);
    if (!file.endsWith('.ts') || !s.sp.isStoryFile(abs)) {
        throw HttpError.badRequest(`Field "file": ${file} is not a story file under data/ or types/`);
    }
    return s.edit(abs, file);
};

const insertLiteral = (sf: SourceFile, name: string, values: string[], afterImports: boolean) => {
    const alias = { name, isExported: true, type: unionText(values) };
    const imports = sf.getImportDeclarations();
    const last = imports[imports.length - 1];
    if (afterImports) sf.insertTypeAlias(last ? last.getChildIndex() + 1 : 0, alias);
    else sf.addTypeAlias(alias);
};

export const createLiteral = ({ sp, bus }: TWriter, rawBody: TCreateLiteralBody) =>
    sp.run(async (): Promise<TLiteralDto> => {
        const body = asBody(rawBody);
        const name = assertStructName(body.name, readStructure(sp));
        const values = parseLiteralValues(body.values);
        const file = optionalText(body, 'file');
        const s = sp.session();
        s.apply(() => {
            if (file === undefined || file === LITERALS_FILE) {
                const sf = globalLiteralsFile(s);
                removeEmptyExports(sf);
                insertLiteral(sf, name, values, false);
            } else {
                insertLiteral(localLiteralsFile(s, file), name, values, true);
            }
        });
        await s.commit(bus, () => structureEvent(sp, 'created'));
        return findLiteral(sp, name);
    });

const stringLiterals = (sf: SourceFile): StringLiteral[] =>
    sf
        .getDescendantsOfKind(SyntaxKind.StringLiteral)
        .filter(
            (lit) =>
                !lit.getFirstAncestorByKind(SyntaxKind.LiteralType) &&
                !lit.getFirstAncestorByKind(SyntaxKind.ImportDeclaration) &&
                !lit.getFirstAncestorByKind(SyntaxKind.ExportDeclaration)
        );

const stringMembers = (type: Type): string[] =>
    (type.isUnion() ? type.getUnionTypes() : [type]).flatMap((t) => {
        const value = t.isStringLiteral() ? t.getLiteralValue() : undefined;
        return typeof value === 'string' ? [value] : [];
    });

// a value typed by the literal: its contextual type holds every member of it
const typedBy = (lit: StringLiteral, values: readonly string[]): boolean => {
    const type = lit.getProject().getTypeChecker().getContextualType(lit);
    if (!type) return false;
    const members = stringMembers(type);
    return values.every((value) => members.includes(value));
};

/** Value → the string literals in the story typed by this literal. */
const literalUsages = (sp: SourceProject, literal: TLiteralDto): Map<string, StringLiteral[]> => {
    const usages = new Map<string, StringLiteral[]>();
    for (const sf of sp.storyFiles()) {
        for (const lit of stringLiterals(sf)) {
            const value = lit.getLiteralText();
            if (!literal.values.includes(value) || !typedBy(lit, literal.values)) continue;
            usages.set(value, [...(usages.get(value) ?? []), lit]);
        }
    }
    return usages;
};

const referencesTo = (sp: SourceProject, nodes: Node[]): TReferenceDto[] =>
    dedupe(nodes.map((node) => referenceAt(sp, node.getSourceFile(), lineOf(node))));

const assertRenames = (renames: [string, string][], current: string[], next: string[]) => {
    for (const [from, to] of renames) {
        if (!current.includes(from)) throw HttpError.badRequest(`renames: no value "${from}"`);
        if (!next.includes(to)) throw HttpError.badRequest(`renames: "${to}" is not in values`);
        if (next.includes(from)) throw HttpError.badRequest(`renames: "${from}" is renamed but also kept`);
    }
};

export const updateLiteral = ({ sp, bus }: TWriter, name: string, rawBody: TUpdateLiteralBody) =>
    sp.run(async (): Promise<TLiteralDto> => {
        const body = asBody(rawBody);
        const literal = findLiteral(sp, name);
        assertCurrentVersion(body, literal);
        const values = parseLiteralValues(body.values);
        const renames = parseRenames(body.renames);
        assertRenames(renames, literal.values, values);
        const removed = literal.values.filter((v) => !values.includes(v) && !renames.some(([from]) => from === v));
        const usages = literalUsages(sp, literal);
        const used = removed.flatMap((value) => usages.get(value) ?? []);
        if (used.length > 0) throw HttpError.referenced(referencesTo(sp, used), 'A removed value is still used');
        const abs = sp.root.abs(literal.file);
        const s = sp.session();
        s.apply(() => {
            const renamed = renames.flatMap(([from, to]) => (usages.get(from) ?? []).map((lit) => ({ lit, to })));
            for (const { lit } of renamed) s.edit(lit.getSourceFile().getFilePath());
            for (const { lit, to } of renamed) lit.replaceWithText(quote(to));
            setUnionMembers(literalAlias(s.edit(abs), name), values.map(quote));
        });
        // a usage the type checker did not see (`x === 'old'`) fails the type check
        const written = await s.commit(
            bus,
            () => structureEvent(sp, 'updated'),
            removed.length > 0 || renames.length > 0 ? { asReferences: (d) => diagnosticsAsReferences(sp, d) } : {}
        );
        emitWrittenResources(bus, sp, written);
        return findLiteral(sp, name);
    });

export const addLiteralValue = ({ sp, bus }: TWriter, name: string, rawBody: TAddLiteralValueBody) =>
    sp.run(async (): Promise<TLiteralDto> => {
        const value = requireText(asBody(rawBody), 'value');
        const literal = findLiteral(sp, name);
        if (literal.values.includes(value)) throw HttpError.exists(`"${value}" is already a value of ${name}`);
        const s = sp.session();
        s.apply(() => {
            const sf = s.edit(sp.root.abs(literal.file));
            setUnionMembers(literalAlias(sf, name), [...literal.values, value].map(quote));
        });
        await s.commit(bus, () => structureEvent(sp, 'updated'));
        return findLiteral(sp, name);
    });

export const deleteLiteral = ({ sp, bus }: TWriter, name: string, rawBody: TDeleteLiteralBody) =>
    sp.run(async (): Promise<TOkDto> => {
        const body = asBody(rawBody);
        const literal = findLiteral(sp, name);
        assertCurrentVersion(body, literal);
        const abs = sp.root.abs(literal.file);
        const alias = literalAlias(sp.fileOrThrow(abs), name);
        const refs = alias
            .getNameNode()
            .findReferencesAsNodes()
            .filter((node) => !alias.containsRange(node.getPos(), node.getEnd()));
        if (refs.length > 0) throw HttpError.referenced(referencesTo(sp, refs), `Literal "${name}" is still used`);
        const s = sp.session();
        s.apply(() => removeStatement(literalAlias(s.edit(abs), name)));
        await s.commit(bus, () => structureEvent(sp, 'deleted'), {
            asReferences: (d) => diagnosticsAsReferences(sp, d),
        });
        return { ok: true };
    });
