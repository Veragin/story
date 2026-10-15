import type { TStoryInfoDto } from '@story/visualizer-protocol';
import type { TServerContext } from '../context';
import { assertVersion } from '../events/version';
import { HttpError } from '../http/HttpError';
import { RAW_RESPONSE } from '../http/router';
import { applyUpdateStoryBody } from '../stories/storyInput';
import { toStoryDto } from '../stories/StoryStore';
import { zipStory } from '../stories/zip';

export const registerStoryInfoRoutes = ({ router, storyId, stories, project }: TServerContext) => {
    const readCurrent = async () => {
        const current = await stories.readVersioned(storyId);
        if (!current) throw HttpError.noStory(storyId);
        return current;
    };

    const readInfo = async (): Promise<TStoryInfoDto> => {
        const current = await readCurrent();
        return { ...toStoryDto(storyId, current.file), version: current.version };
    };

    router
        .handle('getStoryInfo', readInfo)
        .handle('updateStoryInfo', ({ body }) =>
            stories.exclusive(async (): Promise<TStoryInfoDto> => {
                const current = await readCurrent();
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
