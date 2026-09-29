import { isStoryId, MAX_STORY_ZIP_BYTES, type TStoryDto, type TStoryListItemDto } from '@story/visualizer-protocol';
import { readSessionToken, sessionCookie } from '../auth/cookie';
import { isSupportedPasswordHash } from '../auth/password';
import type { TGlobalContext } from '../context';
import { readRawBody } from '../http/body';
import { HttpError } from '../http/HttpError';
import { createStoryFolder, importStoryFolder } from '../stories/storyFolders';
import { parseCreateStoryBody } from '../stories/storyInput';
import { parseStoryFile, STORY_FILE, toStoryDto, type TStoryFile } from '../stories/StoryStore';
import { unzipStory } from '../stories/zip';

/** The `story.json` of an unpacked zip, validated (400 otherwise). */
const zipStoryFile = (files: Map<string, Uint8Array>): TStoryFile => {
    let file: TStoryFile;
    try {
        file = parseStoryFile(JSON.parse(new TextDecoder().decode(files.get(STORY_FILE))));
    } catch (e) {
        throw HttpError.badRequest(`The zip's ${STORY_FILE} is not valid: ${(e as Error).message}`);
    }
    if (!isSupportedPasswordHash(file.password)) {
        throw HttpError.badRequest(`The zip's ${STORY_FILE} has no usable password hash`);
    }
    return file;
};

/**
 * The stories themselves (multiple stories, phase 5). None needs a grant (plan D5: whoever
 * reaches the landing page may create or import); the per-story info and export are story
 * routes (`routes/storyInfo.ts`).
 *
 *  - `GET /api/stories` → every story without its password, sorted by name, with `unlocked`
 *  - `POST /api/stories` → create from `Visualizer/server/template/`, log the creator in, `201`
 *  - `POST /api/stories/import?id=<id>` (raw `application/zip`) → `201`, `409 exists` when the
 *    id is taken (plan D8)
 */
export const registerStoryRoutes = ({ router, stories, sessions, cookieSecure }: TGlobalContext) => {
    router
        .handle('listStories', async ({ req }): Promise<TStoryListItemDto[]> => {
            const unlocked = new Set(sessions.storyIds(readSessionToken(req)));
            return (await stories.list()).map(({ id, file }) => ({
                ...toStoryDto(id, file),
                unlocked: unlocked.has(id),
            }));
        })
        .handle('createStory', async ({ body, req, res }): Promise<TStoryDto> => {
            const file = await parseCreateStoryBody(body);
            const id = await createStoryFolder(stories, file);
            const { token } = sessions.grant(readSessionToken(req), id);
            res.setHeader('set-cookie', sessionCookie(token, cookieSecure));
            return toStoryDto(id, file);
        })
        .handle('importStory', async ({ query, req }): Promise<TStoryDto> => {
            const id = query.get('id') ?? '';
            if (!isStoryId(id)) {
                throw HttpError.badRequest(
                    'Query "id" must be a story id: lowercase letters, digits and "-", at most 64 characters'
                );
            }
            if (await stories.exists(id))
                throw HttpError.exists(`A story "${id}" already exists; import it under another id`);
            const files = unzipStory(await readRawBody(req, MAX_STORY_ZIP_BYTES));
            const file = zipStoryFile(files);
            await importStoryFolder(stories, id, files);
            return toStoryDto(id, file);
        });
};
