import { STORED_WEBP_QUALITY } from '@story/protocol';

const WEBP_TYPE = 'image/webp';
const PNG_TYPE = 'image/png';

export const CONVERTED_IMAGE_TYPES = [PNG_TYPE, 'image/jpeg'];

export const ACCEPTED_IMAGE_TYPES = [WEBP_TYPE, ...CONVERTED_IMAGE_TYPES].join(',');

const canvasBlob = (canvas: HTMLCanvasElement) =>
    new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('Could not convert the image'))),
            WEBP_TYPE,
            STORED_WEBP_QUALITY
        )
    );

const toWebp = async (file: Blob): Promise<Blob> => {
    const bitmap = await createImageBitmap(file);
    try {
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Could not convert the image');
        context.drawImage(bitmap, 0, 0);
        return await canvasBlob(canvas);
    } finally {
        bitmap.close();
    }
};

export const isUploadableImage = (file: Blob) => file.type === WEBP_TYPE || CONVERTED_IMAGE_TYPES.includes(file.type);

export const toStoredImage = async (file: Blob): Promise<Blob> => {
    if (file.type === WEBP_TYPE) return file;
    const converted = await toWebp(file);
    // a browser that cannot encode webp answers a png, which the server accepts too; an original png is kept then
    return converted.type !== WEBP_TYPE && file.type === PNG_TYPE ? file : converted;
};
