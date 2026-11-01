import path from 'node:path';
import { LANDING_IMAGE_FILE, LANDING_WEBP_FILE } from '@story/protocol';
import { lstatOrNull } from '../common/fileStat';

export const landingImagePath = (storyDir: string): string => path.join(storyDir, LANDING_IMAGE_FILE);

const isPlainFile = async (file: string): Promise<boolean> => (await lstatOrNull(file))?.isFile() ?? false;

// a symlink could lead out of the story
export const hasLandingImage = async (storyDir: string): Promise<boolean> =>
    (await isPlainFile(landingImagePath(storyDir))) || isPlainFile(path.join(storyDir, LANDING_WEBP_FILE));
