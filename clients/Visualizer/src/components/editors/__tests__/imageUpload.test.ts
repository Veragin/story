import { afterEach, describe, expect, it, vi } from 'vitest';
import { isUploadableImage, toStoredImage } from '../imageUpload';

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

const stubCanvas = (encoded: Blob) => {
    const close = vi.fn();
    vi.stubGlobal(
        'createImageBitmap',
        vi.fn(() => Promise.resolve({ width: 4, height: 3, close }))
    );
    const drawImage = vi.fn();
    // jsdom has no canvas
    vi.stubGlobal('CanvasRenderingContext2D', class {});
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
        Object.assign(Object.create(CanvasRenderingContext2D.prototype), {
            drawImage,
        })
    );
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(encoded));
    return { close, drawImage, toBlob };
};

describe('imageUpload', () => {
    it('accepts PNG, WebP and JPEG only', () => {
        expect(isUploadableImage(new Blob([], { type: 'image/png' }))).toBe(true);
        expect(isUploadableImage(new Blob([], { type: 'image/webp' }))).toBe(true);
        expect(isUploadableImage(new Blob([], { type: 'image/jpeg' }))).toBe(true);
        expect(isUploadableImage(new Blob([], { type: 'image/gif' }))).toBe(false);
    });

    it('keeps a WebP as it is', async () => {
        const webp = new Blob(['webp'], { type: 'image/webp' });
        expect(await toStoredImage(webp)).toBe(webp);
    });

    it.each(['image/jpeg', 'image/png'])('converts %s to WebP', async (type) => {
        const webp = new Blob(['webp'], { type: 'image/webp' });
        const { close, drawImage, toBlob } = stubCanvas(webp);

        expect(await toStoredImage(new Blob(['source'], { type }))).toBe(webp);
        expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0);
        expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/webp', 0.8);
        expect(close).toHaveBeenCalled();
    });

    it('keeps the PNG when the browser cannot encode WebP', async () => {
        stubCanvas(new Blob(['reencoded'], { type: 'image/png' }));
        const png = new Blob(['png'], { type: 'image/png' });
        expect(await toStoredImage(png)).toBe(png);
    });

    it('stores a JPEG as PNG when the browser cannot encode WebP', async () => {
        const fallback = new Blob(['png'], { type: 'image/png' });
        stubCanvas(fallback);
        expect(await toStoredImage(new Blob(['jpeg'], { type: 'image/jpeg' }))).toBe(fallback);
    });
});
