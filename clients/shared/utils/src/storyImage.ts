export const IMAGE_LINK_PREFIX = '@';

export const STORY_DATA_DIR = 'data/';

export const isStoryImageFile = (file: string) => file.startsWith(STORY_DATA_DIR) && file.endsWith('.png');

export const imageLinkPath = (image: string): string | undefined =>
    image.startsWith(IMAGE_LINK_PREFIX) ? image.slice(IMAGE_LINK_PREFIX.length).trim() : undefined;

export const imageDescription = (image: string): string => (imageLinkPath(image) === undefined ? image : '');
