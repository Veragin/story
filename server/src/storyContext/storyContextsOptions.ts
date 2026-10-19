export type TStoryContextsOptions = {
    watch: boolean;
    batchMs?: number;
    idleMs: number;
    sweepMs?: number;
};

export const STORY_CONTEXTS_OPTIONS = Symbol('STORY_CONTEXTS_OPTIONS');

export const DEFAULT_STORY_CONTEXTS_OPTIONS: TStoryContextsOptions = { watch: true, idleMs: 30 * 60_000 };
