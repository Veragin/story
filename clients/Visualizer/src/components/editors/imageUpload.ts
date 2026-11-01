export const STORED_IMAGE_TYPES = ['image/png', 'image/webp'];

export const CONVERTED_IMAGE_TYPES = ['image/jpeg'];

export const ACCEPTED_IMAGE_TYPES = [...STORED_IMAGE_TYPES, ...CONVERTED_IMAGE_TYPES].join(',');

const WEBP_QUALITY = 0.8;

const canvasBlob = (canvas: HTMLCanvasElement) =>
    new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('Could not convert the image'))),
            'image/webp',
            WEBP_QUALITY
        )
    );

// a browser that cannot encode webp falls back to a png, which the server accepts too
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

export const isUploadableImage = (file: Blob) =>
    STORED_IMAGE_TYPES.includes(file.type) || CONVERTED_IMAGE_TYPES.includes(file.type);

export const toStoredImage = (file: Blob): Promise<Blob> =>
    STORED_IMAGE_TYPES.includes(file.type) ? Promise.resolve(file) : toWebp(file);
