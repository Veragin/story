import type {
    TChapterCharacterDto,
    TChapterDto,
    TDataTypeDto,
    TMaybeCode,
    TProjectChapterDto,
    TTimeRangeDto,
    TValueRecord,
} from '@story/visualizer-protocol';
import type { SourceFile } from 'ts-morph';
import { version } from '../../events/version';
import { findTypeAlias, getProp, lineOf } from '../ast';
import type { SourceProject } from '../SourceProject';
import {
    chapterCharacterFiles,
    chapterFile,
    chapterObject,
    chapterPassagesFile,
    chapterRef,
    displayName,
    passageLocalId,
    passageSource,
    triggerRef,
} from '../story';
import { readFields, readValue, S, type TField, type TSchema } from '../values';

/** Fields of `TChapter` the Visualizer edits, and how each one reads (plan WP6 "edit chapter info"). */
export const chapterFields = (sp: SourceProject): Record<string, TField> => ({
    title: { schema: S.string },
    description: { schema: S.string },
    timeRange: { schema: S.timeRange },
    location: { schema: S.string },
    children: {
        schema: S.array(
            S.object({
                condition: S.string,
                chapterId: { schema: S.ref(chapterRef(sp)), src: 'chapter' },
            })
        ),
    },
    triggerIds: { schema: S.array(S.ref(triggerRef(sp))), src: 'triggers' },
    init: { schema: S.record() },
});

export const triggerIdsSchema = (sp: SourceProject): TSchema => S.array(S.ref(triggerRef(sp)));

/** `export type T<Name>Data = { … }` next to an entity, by suffix (`ChapterData`, `NpcData`, …). */
export const readDataType = (sf: SourceFile, suffix: string): TDataTypeDto | undefined => {
    const alias = findTypeAlias(sf, (n) => n.startsWith('T') && n.endsWith(suffix));
    const node = alias?.getTypeNode();
    return alias && node ? { name: alias.getName(), code: node.getText() } : undefined;
};

/** The chapter's version: its chapter file and its passages registry (which lists its characters' passages). */
export const chapterVersion = (sp: SourceProject, chapterId: string) =>
    version(sp.text(sp.root.paths.chapterFile(chapterId)), chapterPassagesFile(sp, chapterId)?.getFullText() ?? null);

export const readChapterCharacters = (sp: SourceProject, chapterId: string): TChapterCharacterDto[] =>
    [...chapterCharacterFiles(sp, chapterId)].map(([characterId, files]) => {
        const passageIds = files
            .map((sf) => `${chapterId}-${characterId}-${passageLocalId(passageSource(sf), sf)}`)
            .sort();
        return { characterId, passageCount: passageIds.length, passageIds };
    });

export const readChapter = (sp: SourceProject, chapterId: string): TChapterDto => {
    const sf = chapterFile(sp, chapterId);
    const { decl, obj } = chapterObject(sf);
    const fields = readFields(obj, chapterFields(sp));
    const triggerIds = fields.triggerIds;
    return {
        chapterId,
        version: chapterVersion(sp, chapterId),
        file: sp.root.rel(sf.getFilePath()),
        line: lineOf(decl),
        exportName: decl.getName(),
        title: (fields.title ?? '') as TMaybeCode<string>,
        description: (fields.description ?? '') as TMaybeCode<string>,
        timeRange: (fields.timeRange ?? { code: '' }) as TMaybeCode<TTimeRangeDto>,
        location: (fields.location ?? '') as TMaybeCode<string>,
        children: (fields.children ?? []) as TChapterDto['children'],
        triggerIds: Array.isArray(triggerIds)
            ? (triggerIds as TMaybeCode<string>[])
            : triggerIds
              ? [triggerIds as TMaybeCode<string>]
              : [],
        init: (fields.init ?? {}) as TMaybeCode<TValueRecord>,
        dataType: readDataType(sf, 'ChapterData'),
        characters: readChapterCharacters(sp, chapterId),
    };
};

/** The `/api/project` entry of a chapter. */
export const readProjectChapter = (sp: SourceProject, chapterId: string): TProjectChapterDto | undefined => {
    const sf = sp.file(sp.root.paths.chapterFile(chapterId));
    if (!sf) return undefined;
    const { obj } = chapterObject(sf);
    const children = getProp(obj, 'children');
    const childValue = children ? readValue(children.getInitializerOrThrow(), chapterFields(sp).children.schema) : [];
    const triggers = getProp(obj, 'triggers');
    const triggerValue = triggers ? readValue(triggers.getInitializerOrThrow(), triggerIdsSchema(sp)) : [];
    const timeRange = getProp(obj, 'timeRange');
    return {
        id: chapterId,
        name: displayName(getProp(obj, 'title')?.getInitializer(), chapterId),
        timeRange: (timeRange
            ? readValue(timeRange.getInitializerOrThrow(), S.timeRange)
            : { code: '' }) as TMaybeCode<TTimeRangeDto>,
        characterIds: [...chapterCharacterFiles(sp, chapterId).keys()],
        childIds: Array.isArray(childValue)
            ? (childValue as { chapterId?: unknown }[])
                  .map((c) => c.chapterId)
                  .filter((c): c is string => typeof c === 'string')
            : [],
        triggerIds: Array.isArray(triggerValue) ? triggerValue.filter((t): t is string => typeof t === 'string') : [],
    };
};
