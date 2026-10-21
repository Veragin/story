export class StoryLoaderError extends Error {
    constructor(
        readonly file: string,
        message: string,
        readonly cause?: unknown
    ) {
        super(`${file}: ${message}`);
        this.name = 'StoryLoaderError';
    }
}

export const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err));
