import { stat } from 'node:fs/promises';
import type {
    TChapterLayoutDto,
    TChapterLayoutFile,
    TTimelineLayoutDto,
    TTimelineLayoutFile,
    TVersion,
} from '@story/visualizer-protocol';
import { eventIds } from '@story/visualizer-protocol';
import type { TServerContext } from '../context';
import type { TTransaction } from '../events/EventBus';
import { assertVersion, version } from '../events/version';
import { HttpError } from '../http/HttpError';
import type { ProjectRoot } from '../project/ProjectRoot';
import { readTextOrNull } from './atomicWrite';
import { formatJson, sortKeys } from './format';
import { brokenJsonFileError, expectNumber, expectPoint, expectRecord, onlyKeys, parseRequestBody } from './shape';

const parseTimelineLayout = (value: unknown): TTimelineLayoutFile => {
    const o = expectRecord(value, '');
    onlyKeys(o, '', ['chapters', 'triggers']);
    const chapters: TTimelineLayoutFile['chapters'] = {};
    for (const [id, v] of Object.entries(expectRecord(o.chapters ?? {}, 'chapters'))) {
        const at = `chapters.${id}`;
        const e = expectRecord(v, at);
        onlyKeys(e, at, ['y']);
        chapters[id] = { y: expectNumber(e.y, `${at}.y`) };
    }
    const triggers: TTimelineLayoutFile['triggers'] = {};
    for (const [id, v] of Object.entries(expectRecord(o.triggers ?? {}, 'triggers'))) {
        const at = `triggers.${id}`;
        const e = expectRecord(v, at);
        onlyKeys(e, at, ['y']);
        triggers[id] = e.y === undefined ? {} : { y: expectNumber(e.y, `${at}.y`) };
    }
    return { chapters: sortKeys(chapters), triggers: sortKeys(triggers) };
};

const parseChapterLayout = (value: unknown): TChapterLayoutFile => {
    const o = expectRecord(value, '');
    onlyKeys(o, '', ['passages']);
    const passages: TChapterLayoutFile['passages'] = {};
    for (const [id, v] of Object.entries(expectRecord(o.passages ?? {}, 'passages'))) {
        passages[id] = expectPoint(v, `passages.${id}`);
    }
    return { passages: sortKeys(passages) };
};

const emptyTimeline = (): TTimelineLayoutFile => ({ chapters: {}, triggers: {} });
const emptyChapter = (): TChapterLayoutFile => ({ passages: {} });

type TDocSpec<F> = { file: string; parse: (value: unknown) => F; empty: () => F };

const load = async <F>(project: ProjectRoot, spec: TDocSpec<F>): Promise<{ doc: F | null; version: TVersion }> => {
    const text = await readTextOrNull(spec.file);
    if (text === null) return { doc: null, version: version(null) };
    try {
        return { doc: spec.parse(JSON.parse(text)), version: version(text) };
    } catch (e) {
        throw brokenJsonFileError(project, spec.file, e);
    }
};

const write = async <F>(tx: TTransaction, spec: TDocSpec<F>, doc: F): Promise<TVersion> => {
    const text = await formatJson(spec.parse(doc));
    await tx.writeFile(spec.file, text);
    return version(text);
};

const update = async <F, D>(
    { project, bus }: Pick<TServerContext, 'project' | 'bus'>,
    spec: TDocSpec<F>,
    body: unknown,
    toDto: (doc: F, version: TVersion) => D,
    eventId: string,
    chapterId?: string
): Promise<D> => {
    const { version: expected, ...rest } = expectRecord(body, '');
    const doc = parseRequestBody(spec.parse, rest);
    return await bus.transaction(async (tx) => {
        const current = await load(project, spec);
        await assertVersion(String(expected), current.version, () =>
            toDto(current.doc ?? spec.empty(), current.version)
        );
        const next = await write(tx, spec, doc);
        tx.setEvent({
            kind: 'layout',
            id: eventId,
            version: next,
            op: current.doc ? 'updated' : 'created',
            ...(chapterId !== undefined && { chapterId }),
        });
        return toDto(doc, next);
    });
};

const timelineSpec = (project: ProjectRoot): TDocSpec<TTimelineLayoutFile> => ({
    file: project.paths.timelineLayout,
    parse: parseTimelineLayout,
    empty: emptyTimeline,
});

const timelineDto = (doc: TTimelineLayoutFile, v: TVersion): TTimelineLayoutDto => ({ ...doc, version: v });

export const readTimelineLayoutFile = async (project: ProjectRoot): Promise<TTimelineLayoutFile | null> =>
    (await load(project, timelineSpec(project))).doc;

export const readTimelineLayout = async (project: ProjectRoot): Promise<TTimelineLayoutDto> => {
    const { doc, version } = await load(project, timelineSpec(project));
    return timelineDto(doc ?? emptyTimeline(), version);
};

export const writeTimelineLayoutFile = (tx: TTransaction, doc: TTimelineLayoutFile): Promise<TVersion> =>
    write(tx, timelineSpec(tx.project), doc);

export const updateTimelineLayout = (ctx: Pick<TServerContext, 'project' | 'bus'>, body: unknown) =>
    update(ctx, timelineSpec(ctx.project), body, timelineDto, eventIds.timelineLayout);

const CHAPTER_ID = /^[A-Za-z0-9_]+$/;

const isDirectory = async (dir: string): Promise<boolean> => {
    try {
        return (await stat(dir)).isDirectory();
    } catch {
        return false;
    }
};

const assertChapterDir = async (project: ProjectRoot, chapterId: string): Promise<void> => {
    const found = CHAPTER_ID.test(chapterId) && (await isDirectory(project.paths.chapterDir(chapterId)));
    if (!found) throw HttpError.notFound(`No chapter "${chapterId}"`);
};

const chapterSpec = (project: ProjectRoot, chapterId: string): TDocSpec<TChapterLayoutFile> => ({
    file: project.paths.chapterLayout(chapterId),
    parse: parseChapterLayout,
    empty: emptyChapter,
});

const chapterDto =
    (chapterId: string) =>
    (doc: TChapterLayoutFile, v: TVersion): TChapterLayoutDto => ({ chapterId, ...doc, version: v });

export const readChapterLayoutFile = async (
    project: ProjectRoot,
    chapterId: string
): Promise<TChapterLayoutFile | null> => (await load(project, chapterSpec(project, chapterId))).doc;

export const readChapterLayout = async (project: ProjectRoot, chapterId: string): Promise<TChapterLayoutDto> => {
    await assertChapterDir(project, chapterId);
    const { doc, version } = await load(project, chapterSpec(project, chapterId));
    return chapterDto(chapterId)(doc ?? emptyChapter(), version);
};

export const writeChapterLayoutFile = (tx: TTransaction, chapterId: string, doc: TChapterLayoutFile) =>
    write(tx, chapterSpec(tx.project, chapterId), doc);

export const updateChapterLayout = async (
    ctx: Pick<TServerContext, 'project' | 'bus'>,
    chapterId: string,
    body: unknown
): Promise<TChapterLayoutDto> => {
    await assertChapterDir(ctx.project, chapterId);
    return update(
        ctx,
        chapterSpec(ctx.project, chapterId),
        body,
        chapterDto(chapterId),
        eventIds.chapterLayout(chapterId),
        chapterId
    );
};
