import type { TSessionDto, TStoryAccessDto } from '@story/visualizer-protocol';
import { clearedSessionCookie, readSessionToken, sessionCookie } from '../auth/cookie';
import { clientAddress, loginKey } from '../auth/LoginLimiter';
import { verifyPassword } from '../auth/password';
import type { TGlobalContext } from '../context';
import { requireString } from '../http/body';
import { HttpError } from '../http/HttpError';

/**
 * Auth (multiple stories, phase 4): unlock a story with its password, drop the session, list what
 * is unlocked, and ask what a browser may do with a story. The grant check itself is
 * `stories/access.ts`; the CSRF check (every mutation, these included) is in the dispatcher.
 *
 *  - `POST /api/stories/:storyId/login {password}` → `204` + `story_session` cookie, `401`, `429`
 *  - `POST /api/logout` → `204`, cookie cleared
 *  - `GET /api/session` → `TSessionDto`
 *  - `GET /api/stories/:storyId/access` → `TStoryAccessDto`
 */
export const registerAuthRoutes = ({
    router,
    stories,
    sessions,
    loginLimiter,
    cookieSecure,
    trustProxy,
}: TGlobalContext) => {
    router
        .handle('login', async ({ params, body, req, res }) => {
            const { storyId } = params;
            const password = requireString(body, 'password');
            const story = await stories.read(storyId);
            if (!story) throw HttpError.notFound(`No story "${storyId}"`);
            const key = loginKey(clientAddress(req, trustProxy), storyId);
            if (loginLimiter.isBlocked(key)) {
                throw HttpError.tooManyRequests('Too many wrong passwords, try again in a few minutes');
            }
            if (!(await verifyPassword(password, story.password))) {
                loginLimiter.fail(key);
                throw HttpError.unauthorized('Wrong password');
            }
            loginLimiter.succeed(key);
            const { token } = sessions.grant(readSessionToken(req), storyId);
            res.setHeader('set-cookie', sessionCookie(token, cookieSecure));
            return undefined;
        })
        .handle('logout', ({ req, res }) => {
            sessions.revoke(readSessionToken(req));
            res.setHeader('set-cookie', clearedSessionCookie(cookieSecure));
            return undefined;
        })
        .handle('getSession', ({ req }): TSessionDto => ({ storyIds: sessions.storyIds(readSessionToken(req)) }))
        .handle('getStoryAccess', async ({ params, req }): Promise<TStoryAccessDto> => {
            const story = await stories.read(params.storyId);
            if (!story) throw HttpError.notFound(`No story "${params.storyId}"`);
            const canEdit = sessions.expiresAt(readSessionToken(req), params.storyId) !== null;
            return { canEdit, canPlay: canEdit || story.public };
        });
};
