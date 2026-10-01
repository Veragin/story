import path from 'node:path';
import { capitalize } from '@story/shared';
import type { TDiagnosticDto, TReferenceDto } from '@story/visualizer-protocol';
import { Node, type SourceFile, SyntaxKind, type TypeLiteralNode } from 'ts-morph';
import { HttpError } from '../http/HttpError';
import {
    ensureDefaultImport,
    ensureNamedImport,
    findImportOf,
    getProp,
    importedNames,
    isIdentifierUsed,
    keyText,
    propertyKey,
    quote,
    relativeModule,
    removeImportOf,
    removeImportsResolvingTo,
    removeStatement,
    setUnionMembers,
    unionMembers,
    unwrap,
} from './ast';
import { passageIdOfFile } from './readers/passages';
import type { EditSession, SourceProject } from './SourceProject';
import {
    characterPassageUnionName,
    chapterPassageUnionName,
    passagesRecord,
    registerSection,
    type TRegisterSection,
} from './story';

export const registerAdd = (
    s: EditSession,
    section: TRegisterSection,
    id: string,
    value: { importName: string; targetFile: string } | { text: string }
) => {
    const sf = s.edit(s.sp.root.paths.register, 'register.ts');
    const obj = registerSection(sf, section);
    if (getProp(obj, id) || obj.getProperty(id)) throw HttpError.exists(`register.${section}.${id} already exists`);
    let text: string;
    if ('text' in value) {
        text = value.text;
    } else {
        text = ensureNamedImport(sf, value.importName, relativeModule(sf.getFilePath(), value.targetFile));
    }
    obj.addPropertyAssignment({ name: keyText(id), initializer: text });
};

export const registerRemove = (s: EditSession, section: TRegisterSection, id: string) => {
    const sf = s.edit(s.sp.root.paths.register, 'register.ts');
    const obj = registerSection(sf, section);
    const prop = obj.getProperty(id) ?? getProp(obj, id);
    if (!prop) return;
    const init = Node.isPropertyAssignment(prop) ? unwrap(prop.getInitializerOrThrow()) : undefined;
    const local = Node.isShorthandPropertyAssignment(prop)
        ? prop.getName()
        : init && Node.isIdentifier(init)
          ? init.getText()
          : undefined;
    prop.remove();
    if (local && !isIdentifierUsed(sf, local)) removeImportOf(sf, local);
};

const worldStateSection = (sf: SourceFile, section: string): TypeLiteralNode => {
    const alias = sf.getTypeAliasOrThrow('TWorldState');
    const lit = alias.getTypeNode();
    if (!lit || !Node.isTypeLiteral(lit)) throw new Error('data/TWorldState.ts: TWorldState is not a type literal');
    const member = lit.getProperty(section);
    const node = member?.getTypeNode();
    if (!node || !Node.isTypeLiteral(node))
        throw new Error(`data/TWorldState.ts: TWorldState.${section} is not a type literal`);
    return node;
};

export const worldStateAdd = (
    s: EditSession,
    section: 'characters' | 'npcs' | 'chapters' | 'locations',
    id: string,
    typeText: string,
    { dataType, targetFile, storyTypes = [] }: { dataType?: string; targetFile?: string; storyTypes?: string[] }
) => {
    const sf = s.edit(s.sp.root.paths.worldState, 'TWorldState.ts');
    const lit = worldStateSection(sf, section);
    if (lit.getProperty(id)) throw HttpError.exists(`TWorldState.${section}.${id} already exists`);
    if (dataType && targetFile) ensureNamedImport(sf, dataType, relativeModule(sf.getFilePath(), targetFile));
    const have = importedNames(sf);
    for (const name of storyTypes) if (!have.has(name)) ensureNamedImport(sf, name, '@story/types');
    lit.addProperty({ name: keyText(id), type: typeText });
};

export const worldStateRemove = (
    s: EditSession,
    section: 'characters' | 'npcs' | 'chapters' | 'locations',
    id: string
) => {
    const sf = s.edit(s.sp.root.paths.worldState, 'TWorldState.ts');
    const lit = worldStateSection(sf, section);
    const prop = lit.getProperty(id);
    if (!prop) return;
    const names = prop.getDescendantsOfKind(SyntaxKind.Identifier).map((i) => i.getText());
    prop.remove();
    for (const name of new Set(names)) {
        const decl = findImportOf(sf, name);
        if (decl && decl.getModuleSpecifierValue().startsWith('.') && !isIdentifierUsed(sf, name))
            removeImportOf(sf, name);
    }
};

const passagesFileOf = (s: EditSession, chapterId: string) =>
    s.edit(s.sp.root.paths.chapterPassagesFile(chapterId), `${chapterId}.passages.ts`);

export const emptyPassagesFileText = (chapterId: string) => `import type { Engine } from '@story/core';
import type { TWorldState } from '../../TWorldState';
import { TChapterPassage } from '@story/types';

export type ${chapterPassageUnionName(chapterId)} = never;

const ${chapterId}ChapterPassages: Record<${chapterPassageUnionName(chapterId)}, (s: TWorldState, e: Engine) => TChapterPassage<'${chapterId}'>> = {};

export default ${chapterId}ChapterPassages;
`;

export const passagesAddPassage = (
    s: EditSession,
    chapterId: string,
    characterId: string,
    passageId: string,
    passageFile: string,
    exportName: string
): string => {
    const sf = passagesFileOf(s, chapterId);
    const union = sf.getTypeAlias(characterPassageUnionName(chapterId, characterId));
    if (!union) {
        throw new Error(`${chapterId}.passages.ts has no ${characterPassageUnionName(chapterId, characterId)}`);
    }
    const members = unionMembers(union);
    if (!members.includes(quote(passageId))) setUnionMembers(union, [...members, quote(passageId)]);

    const module = relativeModule(sf.getFilePath(), passageFile);
    const taken = importedNames(sf);
    let local = exportName;
    if (taken.has(local) || sf.getVariableDeclaration(local)) {
        local = `${characterId}${exportName.charAt(0).toUpperCase()}${exportName.slice(1)}`;
        let n = 2;
        while (taken.has(local)) local = `${characterId}${exportName}${n++}`;
    }
    if (exportName === 'default') ensureDefaultImport(sf, local, module);
    else ensureNamedImport(sf, exportName, module, local === exportName ? {} : { alias: local });

    const record = passagesRecord(sf);
    if (!record) throw new Error(`${chapterId}.passages.ts has no Record`);
    if (!getProp(record, passageId)) record.addPropertyAssignment({ name: quote(passageId), initializer: local });
    return local;
};

export const passagesRemovePassage = (
    s: EditSession,
    chapterId: string,
    characterId: string,
    passageId: string,
    passageFile: string
) => {
    const sf = passagesFileOf(s, chapterId);
    const union = sf.getTypeAlias(characterPassageUnionName(chapterId, characterId));
    if (union)
        setUnionMembers(
            union,
            unionMembers(union).filter((m) => m !== quote(passageId) && m !== `"${passageId}"`)
        );
    const record = passagesRecord(sf);
    if (!record) throw new Error(`${chapterId}.passages.ts has no Record`);
    getProp(record, passageId)?.remove();
    const noExt = passageFile.replace(/\.ts$/, '');
    removeImportsResolvingTo(sf, (abs) => abs === passageFile || abs === noExt);
};

export const passagesAddCharacter = (s: EditSession, chapterId: string, characterId: string) => {
    const sf = passagesFileOf(s, chapterId);
    const chapterUnion = sf.getTypeAlias(chapterPassageUnionName(chapterId));
    if (!chapterUnion) throw new Error(`${chapterId}.passages.ts has no ${chapterPassageUnionName(chapterId)}`);
    const name = characterPassageUnionName(chapterId, characterId);
    if (sf.getTypeAlias(name)) throw HttpError.exists(`${name} already exists in ${chapterId}.passages.ts`);
    const siblings = sf
        .getTypeAliases()
        .filter(
            (t) =>
                t !== chapterUnion &&
                t.getName().startsWith(`T${capitalize(chapterId)}`) &&
                t.getName().endsWith('PassageId')
        );
    const anchor = siblings[siblings.length - 1] ?? chapterUnion;
    setUnionMembers(chapterUnion, [...unionMembers(chapterUnion), name]);
    const first = anchor === chapterUnion;
    sf.insertTypeAlias(anchor.getChildIndex() + 1, { name, isExported: true, type: 'never' });
    // matches the blank-line grouping of hand-written files
    if (first) {
        const union = sf.getTypeAliasOrThrow(chapterPassageUnionName(chapterId));
        sf.insertText(union.getEnd(), '\n');
    }
};

export const passagesRemoveCharacter = (s: EditSession, chapterId: string, characterId: string) => {
    const sf = passagesFileOf(s, chapterId);
    const name = characterPassageUnionName(chapterId, characterId);
    const alias = sf.getTypeAlias(name);
    if (alias) removeStatement(alias);
    const chapterUnion = sf.getTypeAlias(chapterPassageUnionName(chapterId));
    if (chapterUnion)
        setUnionMembers(
            chapterUnion,
            unionMembers(chapterUnion).filter((m) => m !== name)
        );
    const record = passagesRecord(sf);
    const prefix = `${chapterId}-${characterId}-`;
    for (const p of [...(record?.getProperties() ?? [])]) {
        const key = propertyKey(p);
        if (key?.startsWith(prefix)) p.remove();
    }
    const dir = s.sp.root.paths.characterPassagesDir(chapterId, characterId);
    removeImportsResolvingTo(sf, (abs) => abs.startsWith(dir + path.sep));
};

const lineText = (sf: SourceFile, line: number) => sf.getFullText().split('\n')[line - 1]?.trim();

export const findStringReferences = (
    sp: SourceProject,
    values: Set<string>,
    exclude: (abs: string) => boolean,
    props?: Set<string>
): TReferenceDto[] => {
    const refs: TReferenceDto[] = [];
    for (const sf of sp.storyFiles()) {
        if (exclude(sf.getFilePath())) continue;
        const literals = [
            ...sf.getDescendantsOfKind(SyntaxKind.StringLiteral),
            ...sf.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
        ];
        for (const lit of literals) {
            if (!values.has(lit.getLiteralText())) continue;
            if (lit.getFirstAncestorByKind(SyntaxKind.ImportDeclaration)) continue;
            if (lit.getFirstAncestorByKind(SyntaxKind.LiteralType)) continue;
            if (props) {
                const parent = lit.getParent();
                if (!Node.isPropertyAssignment(parent) || !props.has(propertyKey(parent) ?? '')) continue;
                if (parent.getInitializer() !== lit) continue;
            }
            refs.push(referenceAt(sp, sf, lit.getStartLineNumber()));
        }
    }
    return dedupe(refs);
};

export const findImportReferences = (
    sp: SourceProject,
    targetFile: string,
    exclude: (abs: string) => boolean
): TReferenceDto[] => {
    const refs: TReferenceDto[] = [];
    for (const sf of sp.storyFiles()) {
        if (exclude(sf.getFilePath()) || sf.getFilePath() === targetFile) continue;
        for (const d of sf.getImportDeclarations()) {
            if (d.getModuleSpecifierSourceFile()?.getFilePath() === targetFile) {
                refs.push(referenceAt(sp, sf, d.getStartLineNumber()));
            }
        }
    }
    return dedupe(refs);
};

export const referenceAt = (sp: SourceProject, sf: SourceFile, line: number): TReferenceDto => {
    const passageId = passageIdOfFile(sp, sf);
    return {
        file: sp.root.rel(sf.getFilePath()),
        line,
        ...(passageId ? { passageId } : {}),
        text: lineText(sf, line),
    };
};

export const diagnosticsAsReferences = (sp: SourceProject, diagnostics: TDiagnosticDto[]): TReferenceDto[] =>
    dedupe(
        diagnostics.map((d) => {
            const sf = sp.file(sp.root.abs(d.file));
            return sf ? referenceAt(sp, sf, d.line) : { file: d.file, line: d.line, text: d.message };
        })
    );

export const dedupe = (refs: TReferenceDto[]): TReferenceDto[] => {
    const seen = new Set<string>();
    return refs.filter((r) => {
        const key = `${r.file}:${r.line}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};
