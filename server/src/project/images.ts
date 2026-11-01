import {
    buildPath,
    EMPTY_VERSION,
    MAX_IMAGE_BYTES,
    PNG_SIGNATURE,
    RIFF_SIGNATURE,
    STORY_LANDING_IMAGE_ID,
    type TDeleteImageBody,
    type TImageDto,
    type TImageOwner,
    type TUploadImageBody,
    WEBP_SIGNATURE,
} from '@story/protocol';
import type { TTransaction } from '../events/EventBus';
import { version } from '../events/version';
import { hasNoLinkedDirWithin, isRegularFileWithin } from '../common/fileStat';
import { HttpError } from '../common/HttpError';
import { readBytesOrNull } from '../json/atomicWrite';
import { landingImagePath } from '../stories/landingImage';
import { findEntitySource } from './readers/entities';
import type { SourceProject } from './SourceProject';
import { findPassageFile } from './story';
import { asBody, assertCurrentVersion, type TWriter } from './writers/common';

type TImageFormat = {
    extension: string;
    contentType: string;
    signature: readonly (readonly [number, readonly number[]])[];
};

const PNG_FORMAT: TImageFormat = { extension: '.png', contentType: 'image/png', signature: [[0, PNG_SIGNATURE]] };

const WEBP_FORMAT: TImageFormat = {
    extension: '.webp',
    contentType: 'image/webp',
    signature: [
        [0, RIFF_SIGNATURE],
        [8, WEBP_SIGNATURE],
    ],
};

// the player prefers webp when both exist, so reading does too
const IMAGE_FORMATS = [WEBP_FORMAT, PNG_FORMAT];

const withoutExtension = (file: string) => file.replace(/\.[^./\\]+$/, '');

const imageFileOf = (stem: string, format: TImageFormat) => `${stem}${format.extension}`;

const siblingFiles = (stem: string) => IMAGE_FORMATS.map((format) => imageFileOf(stem, format));

export const siblingImages = (tsFile: string) => siblingFiles(withoutExtension(tsFile));

export const deleteFiles = async (tx: TTransaction, files: readonly string[]) => {
    for (const file of files) await tx.deleteFile(file);
};

const imageStem = (sp: SourceProject, owner: TImageOwner, id: string): string => {
    if (owner === 'story') {
        if (id !== STORY_LANDING_IMAGE_ID) throw HttpError.notFound(`No story image "${id}"`);
        return withoutExtension(landingImagePath(sp.root.root));
    }
    const tsFile =
        owner === 'passages' ? findPassageFile(sp, id).getFilePath() : findEntitySource(sp, owner, id).sf.getFilePath();
    return withoutExtension(tsFile);
};

const hasBytesAt = (bytes: Uint8Array, offset: number, expected: readonly number[]) =>
    bytes.length > offset + expected.length && expected.every((b, i) => bytes[offset + i] === b);

const formatOf = (bytes: Uint8Array) =>
    IMAGE_FORMATS.find(({ signature }) => signature.every(([offset, expected]) => hasBytesAt(bytes, offset, expected)));

const segmentsOf = (sp: SourceProject, abs: string) => sp.root.rel(abs).split('/');

const readImageBytes = async (sp: SourceProject, abs: string): Promise<Buffer | null> =>
    (await isRegularFileWithin(sp.root.root, segmentsOf(sp, abs))) ? readBytesOrNull(abs) : null;

type TFoundImage = { abs: string; bytes: Buffer | null; contentType: string };

const findImage = async (sp: SourceProject, stem: string): Promise<TFoundImage> => {
    for (const format of IMAGE_FORMATS) {
        const abs = imageFileOf(stem, format);
        const bytes = await readImageBytes(sp, abs);
        if (bytes !== null) return { abs, bytes, contentType: format.contentType };
    }
    return { abs: imageFileOf(stem, PNG_FORMAT), bytes: null, contentType: PNG_FORMAT.contentType };
};

// a linked image reads as none, but writing or deleting through a linked directory would leave the story
const writableImageStem = async (sp: SourceProject, owner: TImageOwner, id: string): Promise<string> => {
    const stem = imageStem(sp, owner, id);
    if (!(await hasNoLinkedDirWithin(sp.root.root, segmentsOf(sp, stem).slice(0, -1)))) {
        throw HttpError.forbidden(`${sp.root.rel(stem)} is behind a symlinked directory`);
    }
    return stem;
};

const toDto = (sp: SourceProject, owner: TImageOwner, id: string, abs: string, bytes: Uint8Array | null): TImageDto => {
    const v = bytes === null ? EMPTY_VERSION : version(bytes);
    return {
        owner,
        id,
        file: sp.root.rel(abs),
        version: v,
        url: bytes === null ? null : `${buildPath(sp.root.storyId, 'getImageFile', { owner, id })}?v=${v}`,
    };
};

export const readImage = (sp: SourceProject, owner: TImageOwner, id: string) =>
    sp.run(async (): Promise<TImageDto> => {
        const { abs, bytes } = await findImage(sp, imageStem(sp, owner, id));
        return toDto(sp, owner, id, abs, bytes);
    });

export const readImageFile = (sp: SourceProject, owner: TImageOwner, id: string) =>
    sp.run(async (): Promise<{ bytes: Buffer; version: string; contentType: string }> => {
        const { abs, bytes, contentType } = await findImage(sp, imageStem(sp, owner, id));
        if (bytes === null) throw HttpError.notFound(`No image ${sp.root.rel(abs)}`);
        return { bytes, version: version(bytes), contentType };
    });

export const uploadImage = ({ sp, bus }: TWriter, owner: TImageOwner, id: string, rawBody: TUploadImageBody) =>
    sp.run(async (): Promise<TImageDto> => {
        const body = asBody(rawBody);
        if (typeof body.data !== 'string' || body.data === '') {
            throw HttpError.badRequest('Field "data" must be the base64-encoded PNG or WebP');
        }
        const bytes = Buffer.from(body.data, 'base64');
        if (bytes.length > MAX_IMAGE_BYTES) {
            throw HttpError.badRequest(`The image is larger than ${MAX_IMAGE_BYTES} bytes`);
        }
        const format = formatOf(bytes);
        if (!format) throw HttpError.badRequest('Only PNG and WebP images are accepted');

        const stem = await writableImageStem(sp, owner, id);
        const found = await findImage(sp, stem);
        assertCurrentVersion(body, toDto(sp, owner, id, found.abs, found.bytes));
        const abs = imageFileOf(stem, format);
        // no change event: images are not event resources and the owner's version is unchanged
        await bus.transaction(async (tx) => {
            await tx.writeFile(abs, bytes);
            await deleteFiles(
                tx,
                siblingFiles(stem).filter((file) => file !== abs)
            );
        });
        return toDto(sp, owner, id, abs, bytes);
    });

export const deleteImage = ({ sp, bus }: TWriter, owner: TImageOwner, id: string, rawBody: TDeleteImageBody) =>
    sp.run(async (): Promise<TImageDto> => {
        const body = asBody(rawBody);
        const stem = await writableImageStem(sp, owner, id);
        const found = await findImage(sp, stem);
        assertCurrentVersion(body, toDto(sp, owner, id, found.abs, found.bytes));
        // no change event, as for an upload
        await bus.transaction((tx) => deleteFiles(tx, siblingFiles(stem)));
        return toDto(sp, owner, id, imageFileOf(stem, PNG_FORMAT), null);
    });
