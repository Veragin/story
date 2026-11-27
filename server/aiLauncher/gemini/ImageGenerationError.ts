export type TImageErrorKind = 'image_failed' | 'unavailable' | 'aborted';

export class ImageGenerationError extends Error {
    constructor(
        readonly kind: TImageErrorKind,
        message: string
    ) {
        super(message);
        this.name = 'ImageGenerationError';
    }
}
