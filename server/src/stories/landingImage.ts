import path from 'node:path';
import { LANDING_IMAGE_FILE } from '@story/protocol';
import { lstatOrNull } from '../common/fileStat';

export const landingImagePath = (storyDir: string): string => path.join(storyDir, LANDING_IMAGE_FILE);

// a symlink could lead out of the story
export const hasLandingImage = async (storyDir: string): Promise<boolean> =>
    (await lstatOrNull(landingImagePath(storyDir)))?.isFile() ?? false;
