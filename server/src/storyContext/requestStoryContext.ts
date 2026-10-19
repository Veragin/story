import type { TServerContext } from './serverContext';

const contexts = new WeakMap<object, TServerContext>();

export const attachStoryContext = (req: object, ctx: TServerContext): void => {
    contexts.set(req, ctx);
};

export const storyContextOf = (req: object): TServerContext => {
    const ctx = contexts.get(req);
    if (!ctx) throw new Error('No story context on this request: is it a story route?');
    return ctx;
};
