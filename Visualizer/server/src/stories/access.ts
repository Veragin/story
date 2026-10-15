import type { IncomingMessage } from 'node:http';
import type { TStoryRouteName } from '@story/visualizer-protocol';
import { readSessionToken } from '../auth/cookie';
import type { SessionStore } from '../auth/SessionStore';
import { HttpError } from '../http/HttpError';
import type { StoryStore } from './StoryStore';

export type TStoryAccessRequest = {
    req: IncomingMessage;
    storyId: string;
    route: TStoryRouteName | null;
};

export type TStoryAccessGrant = { expiresAt: number };

export type TStoryAccessCheck = (
    request: TStoryAccessRequest
) => void | TStoryAccessGrant | Promise<void | TStoryAccessGrant>;

// SingleEngine already shows a public story's art to anyone
export const PUBLIC_STORY_READS: readonly TStoryRouteName[] = ['getImage', 'getImageFile'];

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
