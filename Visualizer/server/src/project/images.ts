import { readFile } from 'node:fs/promises';
import {
    buildPath,
    EMPTY_VERSION,
    MAX_IMAGE_BYTES,
    PNG_SIGNATURE,
    type TImageDto,
    type TImageOwner,
    type TUploadImageBody,
} from '@story/visualizer-protocol';
import { version } from '../events/version';
import { HttpError } from '../http/HttpError';
import { isMissingFileError } from '../json/atomicWrite';
import { findEntitySource } from './readers/entities';
import type { SourceProject } from './SourceProject';
import { findPassageFile } from './story';
import { asBody, assertCurrentVersion, type TWriter } from './writers/common';

export const siblingPng = (tsFile: string) => tsFile.replace(/\.ts$/, '.png');

const imageFile = (sp: SourceProject, owner: TImageOwner, id: string): string => {
    const tsFile =
        owner === 'passages' ? findPassageFile(sp, id).getFilePath() : findEntitySource(sp, owner, id).sf.getFilePath();
    return siblingPng(tsFile);
};

const readBytesOrNull = async (file: string): Promise<Buffer | null> => {
    try {
        return await readFile(file);
    } catch (e) {
        if (isMissingFileError(e)) return null;
        throw e;
    }
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
        const abs = imageFile(sp, owner, id);
        return toDto(sp, owner, id, abs, await readBytesOrNull(abs));
    });

export const readImageFile = (sp: SourceProject, owner: TImageOwner, id: string) =>
    sp.run(async (): Promise<{ bytes: Buffer; version: string }> => {
        const abs = imageFile(sp, owner, id);
        const bytes = await readBytesOrNull(abs);
        if (bytes === null) throw HttpError.notFound(`No image ${sp.root.rel(abs)}`);
        return { bytes, version: version(bytes) };
    });

const isPng = (bytes: Uint8Array) =>
    bytes.length > PNG_SIGNATURE.length && PNG_SIGNATURE.every((b, i) => bytes[i] === b);

export const uploadImage = ({ sp, bus }: TWriter, owner: TImageOwner, id: string, rawBody: TUploadImageBody) =>
    sp.run(async (): Promise<TImageDto> => {
        const body = asBody(rawBody);
        if (typeof body.data !== 'string' || body.data === '') {
            throw HttpError.badRequest('Field "data" must be the base64-encoded PNG');
        }
        const bytes = Buffer.from(body.data, 'base64');
        if (bytes.length > MAX_IMAGE_BYTES) {
            throw HttpError.badRequest(`The image is larger than ${MAX_IMAGE_BYTES} bytes`);
        }
        if (!isPng(bytes)) throw HttpError.badRequest('Only PNG images are accepted');

        const abs = imageFile(sp, owner, id);
        const current = toDto(sp, owner, id, abs, await readBytesOrNull(abs));
        assertCurrentVersion(body, current);
        // no change event: images are not event resources and the owner's version is unchanged
        await bus.transaction((tx) => tx.writeFile(abs, bytes));
        return toDto(sp, owner, id, abs, bytes);
    });
