export const IMAGE_LINK_PREFIX = '@';

export const STORY_DATA_DIR = 'data/';

export const STORY_IMAGE_EXTENSIONS = ['.png', '.webp'];

export const isStoryImageFile = (file: string) =>
    file.startsWith(STORY_DATA_DIR) && STORY_IMAGE_EXTENSIONS.some((extension) => file.endsWith(extension));

export const imageLinkPath = (image: string): string | undefined =>
    image.startsWith(IMAGE_LINK_PREFIX) ? image.slice(IMAGE_LINK_PREFIX.length).trim() : undefined;

export const imageDescription = (image: string): string => (imageLinkPath(image) === undefined ? image : '');
