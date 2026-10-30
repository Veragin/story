import type { TChapterPassagesDto, TFunctionDto, TPassageDto, TPassageEdgeDto, TPassageType } from '@story/protocol';
import { isPassageType } from '@story/shared';
import { Node, type NoSubstitutionTemplateLiteral, type SourceFile, type StringLiteral, SyntaxKind } from 'ts-morph';
import { version } from '../../events/version';
import { propertyKey, stringProp, unwrap } from '../ast';
import type { SourceProject } from '../SourceProject';
import {
    chapterCharacterFiles,
    chapterFile,
    findPassageFile,
    passageLocalId,
    passageSource,
    registeredPassageIds,
    type TPassageSource,
} from '../story';
import { readFields, S, type TField } from '../values';

const LINK = S.object({
    text: S.text,
    passageId: S.string,
    autoPriortiy: S.number,
    cost: S.linkCost,
    onFinish: S.fn(),
});

const BODY_ITEM = S.object({
    condition: S.fn('true'),
    text: S.text,
    links: S.array(LINK),
});

const REDIRECT_ITEM = S.object({
    condition: S.fn('true'),
    redirect: S.string,
});

const EXECUTE: TField = { schema: S.fn(), after: ['id'] };

const DESCRIBED_FIELDS: Record<string, TField> = {
    execute: EXECUTE,
    description: { schema: S.text },
    nextPassageId: { schema: S.string },
};

export const PASSAGE_FIELDS: Record<TPassageType, Record<string, TField>> = {
    start: DESCRIBED_FIELDS,
    screen: {
        execute: EXECUTE,
        title: { schema: S.text },
        image: { schema: S.string },
        body: { schema: S.array(BODY_ITEM) },
    },
    linear: DESCRIBED_FIELDS,
    redirect: {
        execute: EXECUTE,
        body: { schema: S.array(REDIRECT_ITEM) },
    },
    finish: {
        execute: EXECUTE,
        nextPassageId: { schema: S.string },
    },
};

export const PASSAGE_OPTIONAL: Record<TPassageType, string[]> = {
    start: ['execute', 'nextPassageId'],
    screen: ['execute'],
    linear: ['execute', 'nextPassageId'],
    redirect: ['execute'],
    finish: ['execute'],
};

export const passageType = (src: TPassageSource): TPassageType | undefined => {
    const t = stringProp(src.obj, 'type');
    return isPassageType(t) ? t : undefined;
};

const passageOwner = (sp: SourceProject, sf: SourceFile) => {
    const m = /^data\/chapters\/([^/]+)\/([^/]+)\.passages\/[^/]+\.ts$/.exec(sp.root.rel(sf.getFilePath()));
    return m ? { chapterId: m[1], characterId: m[2] } : undefined;
};

export const passageIdOfFile = (sp: SourceProject, sf: SourceFile): string | undefined => {
    const owner = passageOwner(sp, sf);
    if (!owner) return undefined;
    return `${owner.chapterId}-${owner.characterId}-${passageLocalId(passageSource(sf), sf)}`;
};

export const readPassageFile = (sp: SourceProject, sf: SourceFile): TPassageDto => {
    const owner = passageOwner(sp, sf);
    const src = passageSource(sf);
    if (!owner || !src) throw new Error(`${sp.root.rel(sf.getFilePath())}: no passage function returning an object`);
    const localId = passageLocalId(src, sf);
    const type = passageType(src) ?? 'screen';
    const fields = readFields(src.obj, PASSAGE_FIELDS[type]);
    const base = {
        passageId: `${owner.chapterId}-${owner.characterId}-${localId}`,
        chapterId: owner.chapterId,
        characterId: owner.characterId,
        localId,
        version: version(sf.getFullText()),
        file: sp.root.rel(sf.getFilePath()),
        line: src.line,
        exportName: src.exportName,
        params: src.params,
        ...(src.preamble.length > 0 ? { preamble: src.preamble.map((s) => s.getText()).join('\n') } : {}),
        ...(fields.execute !== undefined ? { execute: fields.execute as TFunctionDto } : {}),
    };
    switch (type) {
        case 'screen':
            return {
                ...base,
                type,
                title: (fields.title ?? '') as never,
                image: (fields.image ?? '') as never,
                body: (fields.body ?? []) as never,
            };
        case 'start':
        case 'linear':
            return {
                ...base,
                type,
                description: (fields.description ?? '') as never,
                ...(fields.nextPassageId !== undefined ? { nextPassageId: fields.nextPassageId as never } : {}),
            };
        case 'redirect':
            return { ...base, type, body: (fields.body ?? []) as never };
        case 'finish':
            return { ...base, type, nextPassageId: (fields.nextPassageId ?? '') as never };
    }
};

export const readPassage = (sp: SourceProject, passageId: string): TPassageDto =>
    readPassageFile(sp, findPassageFile(sp, passageId));

const EDGE_KIND: Record<string, TPassageEdgeDto['kind']> = {
    passageId: 'link',
    redirect: 'redirect',
    nextPassageId: 'next',
};

// Any literal inside the initializer counts, so `cond ? 'a' : 'b'` yields conditional edges.
const passageEdges = (sf: SourceFile, from: string, known: Set<string>): TPassageEdgeDto[] => {
    const edges: TPassageEdgeDto[] = [];
    const seen = new Set<string>();
    for (const prop of sf.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
        const kind = EDGE_KIND[propertyKey(prop) ?? ''];
        if (!kind) continue;
        const init = prop.getInitializer();
        if (!init) continue;
        const direct = unwrap(init);
        const plain = Node.isStringLiteral(direct) || Node.isNoSubstitutionTemplateLiteral(direct);
        const literals: (StringLiteral | NoSubstitutionTemplateLiteral)[] = plain
            ? [direct]
            : [
                  ...init.getDescendantsOfKind(SyntaxKind.StringLiteral),
                  ...init.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
              ];
        for (const lit of literals) {
            const to = lit.getLiteralText();
            if (!to.includes('-')) continue;
            const key = `${kind}|${to}|${plain}`;
            if (seen.has(key)) continue;
            seen.add(key);
            edges.push({ from, to, kind, conditional: !plain, resolved: known.has(to) });
        }
    }
    return edges;
};

export const readChapterPassages = (sp: SourceProject, chapterId: string): TChapterPassagesDto => {
    chapterFile(sp, chapterId);
    const known = registeredPassageIds(sp);
    const passages: TPassageDto[] = [];
    const edges: TPassageEdgeDto[] = [];
    for (const files of chapterCharacterFiles(sp, chapterId).values()) {
        for (const sf of files) {
            if (!passageSource(sf)) continue;
            const dto = readPassageFile(sp, sf);
            passages.push(dto);
            edges.push(...passageEdges(sf, dto.passageId, known));
        }
    }
    return { chapterId, passages, edges };
};
