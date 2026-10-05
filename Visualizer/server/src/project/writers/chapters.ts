import path from 'node:path';
import type {
    TAddChapterCharacterBody,
    TChapterDto,
    TCreateChapterBody,
    TOkDto,
    TRemoveChapterCharacterBody,
    TUpdateChapterBody,
} from '@story/visualizer-protocol';
import { HttpError } from '../../http/HttpError';
import { removePassagePositions, removeTimelineEntries } from '../../json';
import { capitalize } from '@story/shared';
import { quote } from '../ast';
import { chapterFields, chapterVersion, readChapter } from '../readers/chapters';
import { passageIdOfFile } from '../readers/passages';
import {
    diagnosticsAsReferences,
    emptyPassagesFileText,
    findImportReferences,
    findStringReferences,
    passagesAddCharacter,
    passagesAddPassage,
    passagesRemoveCharacter,
    registerAdd,
    registerRemove,
    worldStateAdd,
    worldStateRemove,
    dedupe,
} from '../registry';
import {
    assertId,
    chapterCharacterFiles,
    chapterFile,
    chapterObject,
    chapterTriggers,
    registerEntries,
    registeredPassageIds,
} from '../story';
import { applyPartial } from '../values';
import {
    applyDataType,
    asBody,
    assertCurrentVersion,
    DERIVED_FIELDS,
    optionalText,
    requireText,
    type TWriter,
} from './common';
import { newPassageText } from './passages';

const CHAPTER_DERIVED = [...DERIVED_FIELDS, 'chapterId', 'characters', 'dataType'];

export const updateChapter = ({ sp, bus }: TWriter, chapterId: string, rawBody: TUpdateChapterBody) =>
    sp.run(async (): Promise<TChapterDto> => {
        const body = asBody(rawBody);
        const current = readChapter(sp, chapterId);
        assertCurrentVersion(body, current);
        const s = sp.session();
        s.apply(() => {
            const sf = s.edit(sp.root.paths.chapterFile(chapterId));
            applyPartial(chapterObject(sf).obj, body, chapterFields(sp), sf, { skip: CHAPTER_DERIVED });
            applyDataType(sp, sf, body.dataType, 'ChapterData', current.file);
        });
        await s.commit(
            bus,
            () => ({
                kind: 'chapter',
                id: chapterId,
                chapterId,
                version: chapterVersion(sp, chapterId),
                op: 'updated',
            }),
            { fields: { file: sp.root.paths.chapterFile(chapterId) } }
        );
        return readChapter(sp, chapterId);
    });

const newChapterText = (id: string, title: string, description: string, location: string, start: string, end: string) =>
    `import { Time } from '@story/shared';
import { TChapter } from '@story/types';

export const ${id}Chapter: TChapter<'${id}'> = {
    chapterId: '${id}',
    title: ${quote(title)},
    description: ${quote(description)},
    timeRange: {
        start: Time.fromString(${quote(start)}),
        end: Time.fromString(${quote(end)}),
    },
    location: ${quote(location)},

    children: [],

    triggers: [],

    init: {},
};

export type T${capitalize(id)}ChapterData = {};
`;

export const createChapter = ({ sp, bus }: TWriter, rawBody: TCreateChapterBody) =>
    sp.run(async (): Promise<TChapterDto> => {
        const body = asBody(rawBody);
        const chapterId = assertId(body.chapterId, 'chapterId');
        const title = requireText(body, 'title');
        const description = optionalText(body, 'description') ?? '';
        const location = requireText(body, 'location');
        const range = body.timeRange;
        const start = typeof range === 'object' && range !== null && 'start' in range ? range.start : undefined;
        const end = typeof range === 'object' && range !== null && 'end' in range ? range.end : undefined;
        if (typeof start !== 'string' || typeof end !== 'string') {
            throw HttpError.badRequest('Field "timeRange" must be { start, end } time strings');
        }
        if (!registerEntries(sp, 'locations').some((e) => e.id === location)) {
            throw HttpError.badRequest(`Field "location": no location "${location}"`);
        }
        const paths = sp.root.paths;
        if (
            sp.filesUnder(paths.chapterDir(chapterId)).length > 0 ||
            registerEntries(sp, 'chapters').some((e) => e.id === chapterId)
        ) {
            throw HttpError.exists(`Chapter "${chapterId}" already exists`);
        }
        const s = sp.session();
        s.apply(() => {
            s.create(paths.chapterFile(chapterId), newChapterText(chapterId, title, description, location, start, end));
            s.create(paths.chapterPassagesFile(chapterId), emptyPassagesFileText(chapterId));
            registerAdd(s, 'chapters', chapterId, {
                importName: `${chapterId}Chapter`,
                targetFile: paths.chapterFile(chapterId),
            });
            registerAdd(s, 'passages', chapterId, {
                text: `() => import('./chapters/${chapterId}/${chapterId}.passages')`,
            });
            worldStateAdd(
                s,
                'chapters',
                chapterId,
                `{ ref: TChapter<'${chapterId}'> } & T${capitalize(chapterId)}ChapterData`,
                {
                    dataType: `T${capitalize(chapterId)}ChapterData`,
                    targetFile: paths.chapterFile(chapterId),
                    storyTypes: ['TChapter'],
                }
            );
        });
        await s.commit(bus, () => ({
            kind: 'chapter',
            id: chapterId,
            chapterId,
            version: chapterVersion(sp, chapterId),
            op: 'created',
        }));
        return readChapter(sp, chapterId);
    });

export const deleteChapter = ({ sp, bus }: TWriter, chapterId: string, rawBody: { version: string }) =>
    sp.run(async (): Promise<TOkDto> => {
        const body = asBody(rawBody);
        const current = readChapter(sp, chapterId);
        assertCurrentVersion(body, current);
        const paths = sp.root.paths;
        const dir = paths.chapterDir(chapterId);
        const inChapter = (abs: string) => abs.startsWith(dir + path.sep);
        const own = (abs: string) => inChapter(abs) || abs === paths.register || abs === paths.worldState;

        const passageIds = new Set<string>(
            [...registeredPassageIds(sp)].filter((id) => id.startsWith(`${chapterId}-`))
        );
        for (const files of chapterCharacterFiles(sp, chapterId).values()) {
            for (const sf of files) {
                const id = passageIdOfFile(sp, sf);
                if (id) passageIds.add(id);
            }
        }
        const refs = dedupe([
            ...findImportReferences(sp, paths.chapterFile(chapterId), own),
            ...findImportReferences(sp, paths.chapterPassagesFile(chapterId), own),
            ...findStringReferences(sp, passageIds, inChapter),
        ]);
        if (refs.length > 0) throw HttpError.referenced(refs, `Chapter "${chapterId}" is still referenced`);

        const triggerIds = chapterTriggers(sp, chapterId).map((t) => t.triggerId);
        const s = sp.session();
        s.apply(() => {
            s.deleteDir(dir);
            registerRemove(s, 'chapters', chapterId);
            registerRemove(s, 'passages', chapterId);
            worldStateRemove(s, 'chapters', chapterId);
        });
        s.after((tx) => removeTimelineEntries(tx, { chapters: [chapterId], triggers: triggerIds }));
        await s.commit(bus, () => ({ kind: 'chapter', id: chapterId, chapterId, version: null, op: 'deleted' }), {
            asReferences: (d) => diagnosticsAsReferences(sp, d),
        });
        return { ok: true };
    });

export const addChapterCharacter = ({ sp, bus }: TWriter, chapterId: string, rawBody: TAddChapterCharacterBody) =>
    sp.run(async (): Promise<TChapterDto> => {
        const body = asBody(rawBody);
        chapterFile(sp, chapterId);
        const characterId = assertId(body.characterId, 'characterId');
        const localId =
            body.startPassageLocalId === undefined
                ? 'intro'
                : assertId(body.startPassageLocalId, 'startPassageLocalId');
        if (!registerEntries(sp, 'characters').some((e) => e.id === characterId)) {
            throw HttpError.badRequest(`Field "characterId": no character "${characterId}"`);
        }
        if (chapterCharacterFiles(sp, chapterId).has(characterId)) {
            throw HttpError.exists(`Character "${characterId}" is already in chapter "${chapterId}"`);
        }
        const passageFile = sp.root.abs('data/chapters', chapterId, `${characterId}.passages`, `${localId}.ts`);
        const passageId = `${chapterId}-${characterId}-${localId}`;
        const s = sp.session();
        s.apply(() => {
            passagesAddCharacter(s, chapterId, characterId);
            s.create(passageFile, newPassageText(chapterId, characterId, localId, 'screen', capitalize(localId)));
            passagesAddPassage(s, chapterId, characterId, passageId, passageFile, `${localId}Passage`);
        });
        await s.commit(bus, () => ({
            kind: 'chapter',
            id: chapterId,
            chapterId,
            version: chapterVersion(sp, chapterId),
            op: 'updated',
        }));
        return readChapter(sp, chapterId);
    });

export const removeChapterCharacter = (
    { sp, bus }: TWriter,
    chapterId: string,
    characterId: string,
    rawBody: TRemoveChapterCharacterBody
) =>
    sp.run(async (): Promise<TChapterDto> => {
        const body = asBody(rawBody);
        const current = readChapter(sp, chapterId);
        assertCurrentVersion(body, current);
        const entry = current.characters.find((c) => c.characterId === characterId);
        if (!entry) throw HttpError.notFound(`Character "${characterId}" is not in chapter "${chapterId}"`);
        const dir = sp.root.paths.characterPassagesDir(chapterId, characterId);
        const passagesFile = sp.root.paths.chapterPassagesFile(chapterId);
        const ids = new Set(entry.passageIds);
        const refs = findStringReferences(sp, ids, (abs) => abs.startsWith(dir + path.sep) || abs === passagesFile);
        if (refs.length > 0) {
            throw HttpError.referenced(refs, `Passages of "${characterId}" in "${chapterId}" are still referenced`);
        }
        const s = sp.session();
        s.apply(() => {
            s.deleteDir(dir);
            passagesRemoveCharacter(s, chapterId, characterId);
        });
        s.after((tx) => removePassagePositions(tx, chapterId, [...ids]));
        await s.commit(
            bus,
            () => ({
                kind: 'chapter',
                id: chapterId,
                chapterId,
                version: chapterVersion(sp, chapterId),
                op: 'updated',
            }),
            { asReferences: (d) => diagnosticsAsReferences(sp, d) }
        );
        return readChapter(sp, chapterId);
    });
