import { imageLinkPath, isStoryImageFile, resolvePath, STORY_DATA_DIR } from '@story/shared';
import type { TCharacterId, TNpcId } from '@story/types';

// keyed like ids: npc files are named after their PascalCase export
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

let files: Record<string, string> = {};
let images: Record<string, string> = {};

const imageKey = (rel: string) => {
    const slash = rel.lastIndexOf('/');
    const base = rel.slice(slash + 1).split('.')[0];
    return `${rel.slice(0, slash + 1)}${lowerFirst(base)}`;
};

const isWebp = (rel: string) => rel.endsWith('.webp');

export const setStoryImages = (dataFiles: Record<string, string>) => {
    files = dataFiles;
    const webpLast = Object.entries(dataFiles).sort(([a], [b]) => Number(isWebp(a)) - Number(isWebp(b)));
    images = Object.fromEntries(webpLast.map(([rel, url]) => [imageKey(rel), url]));
};

export const storyImageFiles = (
    storyFiles: readonly string[],
    fileUrl: (path: string) => string
): Record<string, string> =>
    Object.fromEntries(
        storyFiles.filter(isStoryImageFile).map((file) => [file.slice(STORY_DATA_DIR.length), fileUrl(file)])
    );

export const storyIcon = (): string | undefined => images['assets/story'];

type TIllustrated = { chapterId: string; characterId: string; id: string; image: string };

export const passageImage = (passage: TIllustrated): string | undefined => {
    const dir = `chapters/${passage.chapterId}/${passage.characterId}.passages`;
    const link = imageLinkPath(passage.image);
    if (link === undefined) return images[`${dir}/${lowerFirst(passage.id)}`];
    const target = resolvePath(dir, link);
    return target === undefined ? undefined : files[target];
};

export const characterImage = (id: TCharacterId): string | undefined => images[`characters/${lowerFirst(id)}`];

export const npcImage = (id: TNpcId): string | undefined => images[`npcs/${lowerFirst(id)}`];

export const landingImage = (): string | undefined => images['assets/landing'];
