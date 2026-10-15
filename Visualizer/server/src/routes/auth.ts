import type { TSessionDto, TStoryAccessDto } from '@story/visualizer-protocol';
import { clearedSessionCookie, readSessionToken, sessionCookie } from '../auth/cookie';
import { clientAddress, loginKey } from '../auth/LoginLimiter';
import { verifyPassword } from '../auth/password';
import type { TGlobalContext } from '../context';
import { requireString } from '../http/body';
import { HttpError } from '../http/HttpError';

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
            if (!story) throw HttpError.noStory(storyId);
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
            if (!story) throw HttpError.noStory(params.storyId);
            const canEdit = sessions.expiresAt(readSessionToken(req), params.storyId) !== null;
            return { canEdit, canPlay: canEdit || story.public };
        });
};
