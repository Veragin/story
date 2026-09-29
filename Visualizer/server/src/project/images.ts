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
import { assertVersion, version } from '../events/version';
import { HttpError } from '../http/HttpError';
import { findEntitySource } from './readers/entities';
import type { SourceProject } from './SourceProject';
import { findPassageFile } from './story';
import { asBody, type TWriter } from './writers/common';

/**
 * Story art (protocol `dto/image.ts`): the image of a passage, character or npc is the `.png`
 * next to its `.ts` file, with the same basename (`annie.passages/palace.ts` →
 * `annie.passages/palace.png`, `npcs/Franta.ts` → `npcs/Franta.png`). The owner's file is found
 * the way every other route finds it (passage folder + `id`, `register.ts` entry), so the image
 * follows the file wherever the author keeps it. Only PNG is accepted and nothing is converted:
 * the server has no image library, and the story's apps load the file as it is.
 */

/** `…/palace.ts` → `…/palace.png`. */
export const siblingPng = (tsFile: string) => tsFile.replace(/\.ts$/, '.png');

/** Absolute path of an owner's image (which need not exist). 404 when the owner does not. */
export const imageFile = (sp: SourceProject, owner: TImageOwner, id: string): string => {
    const tsFile =
        owner === 'passages' ? findPassageFile(sp, id).getFilePath() : findEntitySource(sp, owner, id).sf.getFilePath();
    return siblingPng(tsFile);
};

const readBytesOrNull = async (file: string): Promise<Buffer | null> => {
    try {
        return await readFile(file);
    } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
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

/** `GET /images/:owner/:id` */
export const readImage = (sp: SourceProject, owner: TImageOwner, id: string) =>
    sp.run(async (): Promise<TImageDto> => {
        const abs = imageFile(sp, owner, id);
        return toDto(sp, owner, id, abs, await readBytesOrNull(abs));
    });

/** `GET /images/:owner/:id/png` — the bytes and their version; 404 when there is no image. */
export const readImageFile = (sp: SourceProject, owner: TImageOwner, id: string) =>
    sp.run(async (): Promise<{ bytes: Buffer; version: string }> => {
        const abs = imageFile(sp, owner, id);
        const bytes = await readBytesOrNull(abs);
        if (bytes === null) throw HttpError.notFound(`No image ${sp.root.rel(abs)}`);
        return { bytes, version: version(bytes) };
    });

const isPng = (bytes: Uint8Array) =>
    bytes.length > PNG_SIGNATURE.length && PNG_SIGNATURE.every((b, i) => bytes[i] === b);

/** `PUT /images/:owner/:id` — write the owner's sibling `.png` (create or replace). */
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
        await assertVersion(body.version as string, current.version, () => current);
        // no change event: an image is not a resource of `dto/events.ts`, and the owner's own
        // version (the hash of its `.ts`) does not change
        await bus.transaction((tx) => tx.writeFile(abs, bytes));
        return toDto(sp, owner, id, abs, bytes);
    });
