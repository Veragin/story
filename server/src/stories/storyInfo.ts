import type { TStoryInfoDto } from '@story/protocol';
import type { TVersionedStoryFile } from '../database/repositories/StoryRepository';
import { hasLandingImage } from './landingImage';
import { toStoryDto } from './storyFile';

export const buildStoryInfo = async (
    storyId: string,
    { file, version }: TVersionedStoryFile,
    storyDir: string
): Promise<TStoryInfoDto> => ({
    ...toStoryDto(storyId, file),
    version,
    hasLandingImage: await hasLandingImage(storyDir),
});
