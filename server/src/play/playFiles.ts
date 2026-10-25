import path from 'node:path';
import type { TPlayManifestDto } from '@story/protocol';
import { isRegularFileWithin } from '../common/fileStat';
import { HttpError } from '../common/HttpError';
import type { TVersionedFile } from '../common/versionedFile';
import type { TVersionedStoryFile } from '../database/repositories/StoryRepository';
import { version } from '../events/version';
import { isTempFile, readBytesOrNull } from '../json/atomicWrite';
import { hasLandingImage } from '../stories/landingImage';
import { listStoryDirFiles, STORY_TOP_DIRS } from '../stories/storyFiles';

const PLAY_CONTENT_TYPES = new Map([
    ['.ts', 'text/typescript; charset=utf-8'],
    ['.png', 'image/png'],
]);

const PLAY_SKIPPED_DIRS = ['node_modules', '__tests__'];

const contentTypeOf = (rel: string) => PLAY_CONTENT_TYPES.get(path.posix.extname(rel));

export const listPlayFiles = async (storyDir: string): Promise<string[]> =>
    (await listStoryDirFiles(storyDir, PLAY_SKIPPED_DIRS)).filter((rel) => contentTypeOf(rel) !== undefined).sort();

// picks the fields one by one: the row also holds the password hash
export const buildPlayManifest = async (
    storyId: string,
    { file: { name, author, description }, version: storyVersion }: TVersionedStoryFile,
    storyDir: string
): Promise<TPlayManifestDto> => ({
    id: storyId,
    name,
    author,
    description,
    version: storyVersion,
    hasLandingImage: await hasLandingImage(storyDir),
    files: await listPlayFiles(storyDir),
});

const isPlainSegment = (segment: string) =>
    segment !== '' && segment !== '.' && segment !== '..' && !segment.includes('\\') && !segment.includes('\0');

const playFileOf = (rel: string): { segments: string[]; contentType: string } => {
    const segments = rel.split('/');
    const contentType = contentTypeOf(rel);
    const playable =
        contentType !== undefined &&
        segments.every(isPlainSegment) &&
        STORY_TOP_DIRS.includes(segments[0]) &&
        !segments.some((s) => PLAY_SKIPPED_DIRS.includes(s)) &&
        !isTempFile(rel);
    if (!playable) throw HttpError.badRequest(`Not a playable story file: ${JSON.stringify(rel)}`);
    return { segments, contentType };
};

export const readPlayFile = async (storyDir: string, rel: string): Promise<TVersionedFile> => {
    const { segments, contentType } = playFileOf(rel);
    const missing = () => HttpError.notFound(`No file ${rel}`);
    if (!(await isRegularFileWithin(storyDir, segments))) throw missing();
    const bytes = await readBytesOrNull(path.join(storyDir, ...segments));
    if (bytes === null) throw missing();
    return { bytes, version: version(bytes), contentType };
};
