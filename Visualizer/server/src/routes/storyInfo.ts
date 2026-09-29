import type { TStoryInfoDto } from '@story/visualizer-protocol';
import type { TServerContext } from '../context';
import { assertVersion } from '../events/version';
import { HttpError } from '../http/HttpError';
import { RAW_RESPONSE } from '../http/router';
import { applyUpdateStoryBody } from '../stories/storyInput';
import { toStoryDto } from '../stories/StoryStore';
import { zipStory } from '../stories/zip';

/**
 * One story's `story.json` and its zip (multiple stories, phase 5). Story routes, so they need
 * the story's grant like every other one (`stories/access.ts`).
 *
 *  - `GET /info` → `TStoryInfoDto` (no password; `version` = hash of `story.json`)
 *  - `PUT /info` → partial edit of name, author, description, public, a new password; `mapSize`
 *    is read-only (plan D6). `409 stale` on a version mismatch. No change event: `story.json` is
 *    not a resource of the feed.
 *  - `GET /export` → `<storyId>.zip` as an attachment (`stories/zip.ts`)
 */
export const registerStoryInfoRoutes = ({ router, storyId, stories, project }: TServerContext) => {
    const readInfo = async (): Promise<TStoryInfoDto> => {
        const current = await stories.readVersioned(storyId);
        if (!current) throw HttpError.notFound(`No story "${storyId}"`);
        return { ...toStoryDto(storyId, current.file), version: current.version };
    };

    router
        .handle('getStoryInfo', readInfo)
        .handle('updateStoryInfo', ({ body }) =>
            stories.exclusive(async (): Promise<TStoryInfoDto> => {
                const current = await stories.readVersioned(storyId);
                if (!current) throw HttpError.notFound(`No story "${storyId}"`);
                await assertVersion(body.version, current.version, readInfo);
                const next = await applyUpdateStoryBody(storyId, current.file, body);
                const version = await stories.write(storyId, next);
                return { ...toStoryDto(storyId, next), version };
            })
        )
        .handle('exportStory', async ({ res }): Promise<typeof RAW_RESPONSE> => {
            const zip = await zipStory(project.root);
            res.writeHead(200, {
                'content-type': 'application/zip',
                'content-disposition': `attachment; filename="${storyId}.zip"`,
                'content-length': zip.byteLength,
                'cache-control': 'no-store',
            });
            res.end(zip);
            return RAW_RESPONSE;
        });
};
