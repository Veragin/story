import { afterEach, describe, expect, it, vi } from 'vitest';
import { isUploadableImage, toStoredImage } from '../imageUpload';

afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('imageUpload', () => {
    it('accepts PNG, WebP and JPEG only', () => {
        expect(isUploadableImage(new Blob([], { type: 'image/png' }))).toBe(true);
        expect(isUploadableImage(new Blob([], { type: 'image/webp' }))).toBe(true);
        expect(isUploadableImage(new Blob([], { type: 'image/jpeg' }))).toBe(true);
        expect(isUploadableImage(new Blob([], { type: 'image/gif' }))).toBe(false);
    });

    it('keeps a PNG or WebP as it is', async () => {
        const png = new Blob(['png'], { type: 'image/png' });
        const webp = new Blob(['webp'], { type: 'image/webp' });
        expect(await toStoredImage(png)).toBe(png);
        expect(await toStoredImage(webp)).toBe(webp);
    });

    it('converts a JPEG to WebP', async () => {
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
        const webp = new Blob(['webp'], { type: 'image/webp' });
        const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(webp));

        const jpeg = new Blob(['jpeg'], { type: 'image/jpeg' });
        expect(await toStoredImage(jpeg)).toBe(webp);
        expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0);
        expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/webp', 0.8);
        expect(close).toHaveBeenCalled();
    });
});
