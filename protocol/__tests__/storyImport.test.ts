import { describe, expect, it } from 'vitest';
import { STORY_IMPORT_ZIP_FIELD, storyImportForm } from '../src';

describe('storyImportForm', () => {
    it('sends every field as text and the zip as a file', () => {
        const zip = new Blob([new Uint8Array([0x50, 0x4b])]);
        const form = storyImportForm(zip, {
            name: 'Tale',
            author: 'Me',
            description: 'A tale.',
            password: 'secret-1',
            public: false,
            email: 'me@example.com',
        });
        expect(Object.fromEntries([...form].filter(([key]) => key !== STORY_IMPORT_ZIP_FIELD))).toEqual({
            name: 'Tale',
            author: 'Me',
            description: 'A tale.',
            email: 'me@example.com',
            password: 'secret-1',
            public: 'false',
        });
        const file = form.get(STORY_IMPORT_ZIP_FIELD);
        expect(file).toBeInstanceOf(File);
        expect(file instanceof File ? [file.name, file.size] : null).toEqual(['story.zip', 2]);
    });
});
