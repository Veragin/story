import type { TMapSizeDto, TStoryDto } from '@story/protocol';
import { isPlainObject } from '../common/isPlainObject';

export const STORY_FILE = 'story.json';

export type TStoryFile = {
    name: string;
    author: string;
    password: string;
    mapSize: TMapSizeDto;
    description: string;
    public: boolean;
};

const isPositiveInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;

const stringField = (v: Record<string, unknown>, key: string): string => {
    const field = v[key];
    if (typeof field !== 'string') throw new Error(`story.json: "${key}" must be a string`);
    return field;
};

export const parseStoryFile = (value: unknown): TStoryFile => {
    if (!isPlainObject(value)) throw new Error('story.json must hold an object');
    const name = stringField(value, 'name');
    const author = stringField(value, 'author');
    const password = stringField(value, 'password');
    const description = stringField(value, 'description');
    if (typeof value.public !== 'boolean') throw new Error('story.json: "public" must be a boolean');
    const { mapSize } = value;
    if (!isPlainObject(mapSize) || !isPositiveInt(mapSize.width) || !isPositiveInt(mapSize.height)) {
        throw new Error('story.json: "mapSize" must be { width, height } in whole tiles');
    }
    return {
        name,
        author,
        password,
        mapSize: { width: mapSize.width, height: mapSize.height },
        description,
        public: value.public,
    };
};

export const toStoryDto = (id: string, file: TStoryFile): TStoryDto => ({
    id,
    name: file.name,
    author: file.author,
    description: file.description,
    mapSize: { ...file.mapSize },
    public: file.public,
});
