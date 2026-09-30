import type {
    TChapterPassagesDto,
    TFunctionDto,
    TPassageDto,
    TPassageEdgeDto,
    TPassageType,
} from '@story/visualizer-protocol';
import { Node, type SourceFile, SyntaxKind } from 'ts-morph';
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
    text: S.string,
    passageId: S.string,
    autoPriortiy: S.number,
    cost: S.linkCost,
    onFinish: S.fn(),
});

const BODY_ITEM = S.object({
    condition: S.fn('true'),
    redirect: S.string,
    text: S.string,
    links: S.array(LINK),
});

/** `execute?: () => void` of every passage type; a new one goes after `id`, before `type`. */
const EXECUTE: TField = { schema: S.fn(), after: ['id'] };

/** Editable fields per passage type (`types/TPassage.ts`). */
export const PASSAGE_FIELDS: Record<TPassageType, Record<string, TField>> = {
    screen: {
        execute: EXECUTE,
        title: { schema: S.string },
        image: { schema: S.string },
        body: { schema: S.array(BODY_ITEM) },
    },
    linear: {
        execute: EXECUTE,
        description: { schema: S.string },
        nextPassageId: { schema: S.string },
    },
    transition: {
        execute: EXECUTE,
        nextPassageId: { schema: S.string },
    },
};

/** Optional fields a PUT may remove with `null`. */
export const PASSAGE_OPTIONAL: Record<TPassageType, string[]> = {
    screen: ['execute'],
    linear: ['execute', 'nextPassageId'],
    transition: ['execute'],
};

export const passageType = (src: TPassageSource): TPassageType | undefined => {
    const t = stringProp(src.obj, 'type');
    return t === 'screen' || t === 'linear' || t === 'transition' ? t : undefined;
};

/** `data/chapters/<ch>/<char>.passages/<file>` → chapter and character ids. */
export const passageOwner = (sp: SourceProject, sf: SourceFile) => {
    const m = /^data\/chapters\/([^/]+)\/([^/]+)\.passages\/[^/]+\.ts$/.exec(sp.root.rel(sf.getFilePath()));
    return m ? { chapterId: m[1], characterId: m[2] } : undefined;
};

/** Full id of the passage in a passage file (from its folder and `id`), or undefined. */
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
        case 'linear':
            return {
                ...base,
                type,
                description: (fields.description ?? '') as never,
                ...(fields.nextPassageId !== undefined ? { nextPassageId: fields.nextPassageId as never } : {}),
            };
        case 'transition':
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

/**
 * Static edges of a passage (plan §1.1): every string literal inside the initializer of a
 * `passageId` / `redirect` / `nextPassageId` property anywhere in the file — so a target inside
 * a condition (`cond ? 'a' : 'b'`) still shows up, marked `conditional`.
 */
export const passageEdges = (sf: SourceFile, from: string, known: Set<string>): TPassageEdgeDto[] => {
    const edges: TPassageEdgeDto[] = [];
    const seen = new Set<string>();
    for (const prop of sf.getDescendantsOfKind(SyntaxKind.PropertyAssignment)) {
        const kind = EDGE_KIND[propertyKey(prop) ?? ''];
        if (!kind) continue;
        const init = prop.getInitializer();
        if (!init) continue;
        const direct = unwrap(init);
        const plain = Node.isStringLiteral(direct) || Node.isNoSubstitutionTemplateLiteral(direct);
        const literals = plain
            ? [direct]
            : [
                  ...init.getDescendantsOfKind(SyntaxKind.StringLiteral),
                  ...init.getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral),
              ];
        for (const lit of literals) {
            const to = (lit as import('ts-morph').StringLiteral).getLiteralText();
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
    chapterFile(sp, chapterId); // 404 for an unknown chapter
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
