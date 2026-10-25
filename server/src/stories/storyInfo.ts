import type { TEditStoryInfoDto, TPublicStoryInfoDto } from '@story/protocol';
import type { TVersionedStoryFile } from '../database/repositories/StoryRepository';
import { hasLandingImage } from './landingImage';
import { toStoryDto, type TStoryFile } from './storyFile';

export const buildStoryInfo = async (
    storyId: string,
    { file, version }: TVersionedStoryFile,
    storyDir: string
): Promise<TEditStoryInfoDto> => ({
    access: 'edit',
    ...toStoryDto(storyId, file),
    version,
    hasLandingImage: await hasLandingImage(storyDir),
    email: file.email,
});

export const publicStoryInfo = (storyId: string, file: TStoryFile): TPublicStoryInfoDto => ({
    access: 'public',
    id: storyId,
    name: file.name,
    author: file.author,
    description: file.description,
});
