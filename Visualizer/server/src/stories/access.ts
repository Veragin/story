import type { IncomingMessage } from 'node:http';
import type { TStoryRouteName } from '@story/visualizer-protocol';
import { readSessionToken } from '../auth/cookie';
import type { SessionStore } from '../auth/SessionStore';
import { HttpError } from '../http/HttpError';
import type { StoryStore } from './StoryStore';

/** What the access check gets for a request under `/api/stories/:storyId/…`. */
export type TStoryAccessRequest = {
    req: IncomingMessage;
    /** A story that exists (the dispatcher checked). */
    storyId: string;
    /** The story route the request matches, or `null` when it matches none (it will answer 404). */
    route: TStoryRouteName | null;
};

/** A let-through that is bounded in time: the dispatcher ends a response still open at `expiresAt`. */
export type TStoryAccessGrant = { expiresAt: number };

/**
 * Decides whether a request may reach a story. It returns to let the request through (with the
 * grant's expiry, if it has one) and throws an `HttpError` (`401 unauthorized`, `403 forbidden`) to
 * refuse it. The dispatcher (`app.ts`) calls it for every story-scoped request, SSE and image bytes
 * included, before the story is loaded, so a refused request costs no ts-morph project.
 *
 * `login` and `getStoryAccess` live under `/api/stories/:storyId/` too, but they are global routes
 * (`GLOBAL_ROUTES`), matched before the dispatcher gets here: they never need a grant.
 */
export type TStoryAccessCheck = (
    request: TStoryAccessRequest
) => void | TStoryAccessGrant | Promise<void | TStoryAccessGrant>;

/** Lets everything through. For tests about something other than auth. */
export const allowAllStoryAccess: TStoryAccessCheck = () => undefined;

/**
 * Story routes that anyone may read, without a grant, **when the story is `public`**: the story art
 * (`getImage`, `getImageFile`). A public story may be played by anyone in SingleEngine (phase 9),
 * which shows the same pictures, so they give nothing away. Nothing else is here: the other routes
 * (the project, chapters, passages, entities, the map, the change feed, every write) are the
 * Visualizer's editing surface, and editing a public story still takes its password. SingleEngine
 * loads the story's source through its own Vite middleware (guarded by `getStoryAccess`), not
 * through these routes.
 */
export const PUBLIC_STORY_READS: readonly TStoryRouteName[] = ['getImage', 'getImageFile'];

/**
 * The access check the app uses: the request's `story_session` cookie must hold an unexpired grant
 * for the story (`SessionStore`), else `401`. The one exception is `PUBLIC_STORY_READS` of a
 * public story. A grant's expiry goes back to the dispatcher, which closes the `/events` stream at
 * that moment.
 */
export const sessionAccessCheck =
    ({ sessions, stories }: { sessions: SessionStore; stories: StoryStore }): TStoryAccessCheck =>
    async ({ req, storyId, route }) => {
        const expiresAt = sessions.expiresAt(readSessionToken(req), storyId);
        if (expiresAt !== null) return { expiresAt };
        if (route !== null && PUBLIC_STORY_READS.includes(route) && (await stories.read(storyId))?.public) {
            return undefined;
        }
        throw HttpError.unauthorized(`Story "${storyId}" is locked: log in with its password first`);
    };
