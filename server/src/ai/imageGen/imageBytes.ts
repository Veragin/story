import { PNG_SIGNATURE, RIFF_SIGNATURE, STORED_WEBP_QUALITY, WEBP_SIGNATURE } from '@story/protocol';
import sharp, { type Sharp } from 'sharp';
import { HttpError } from '../../common/HttpError';

export const REFERENCE_MAX_SIDE = 1024;

export const WEBP_QUALITY = Math.round(STORED_WEBP_QUALITY * 100);

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff] as const;

type TImageFormat = 'png' | 'webp' | 'jpeg';

const SIGNATURES: Readonly<Record<TImageFormat, readonly (readonly [number, readonly number[]])[]>> = {
    png: [[0, PNG_SIGNATURE]],
    webp: [
        [0, RIFF_SIGNATURE],
        [8, WEBP_SIGNATURE],
    ],
    jpeg: [[0, JPEG_SIGNATURE]],
};

const FORMATS: readonly TImageFormat[] = ['png', 'webp', 'jpeg'];

const hasBytesAt = (bytes: Uint8Array, offset: number, expected: readonly number[]) =>
    bytes.length > offset + expected.length && expected.every((byte, i) => bytes[offset + i] === byte);

export const imageFormatOf = (bytes: Uint8Array): TImageFormat | undefined =>
    FORMATS.find((format) => SIGNATURES[format].every(([offset, expected]) => hasBytesAt(bytes, offset, expected)));

const toWebp = (image: Sharp) => image.webp({ quality: WEBP_QUALITY }).toBuffer();

// a reference for Gemini: at most REFERENCE_MAX_SIDE px on the longer side
export const referenceWebp = (bytes: Buffer): Promise<Buffer> =>
    toWebp(sharp(bytes).resize(REFERENCE_MAX_SIDE, REFERENCE_MAX_SIDE, { fit: 'inside', withoutEnlargement: true }));

// what the server stores: a WebP as it is, a PNG or JPEG converted
export const storedWebp = async (bytes: Buffer): Promise<Buffer> => {
    const format = imageFormatOf(bytes);
    if (format === undefined) throw HttpError.of('ai_image_failed', 'Gemini returned no PNG, WebP or JPEG image');
    if (format === 'webp') return bytes;
    try {
        return await toWebp(sharp(bytes));
    } catch {
        throw HttpError.of('ai_image_failed', 'Gemini returned an unreadable image');
    }
};
