import { describe, expect, it } from 'vitest';
import { STORY_LIMITS, type TEditStoryInfoDto } from '@story/protocol';
import {
    EMPTY_STORY_FORM,
    hasErrors,
    storyFormOf,
    toCreateBody,
    toUpdateBody,
    validateStoryForm,
    type TStoryFormValue,
} from '../src/storyForm';

const valid: TStoryFormValue = {
    ...EMPTY_STORY_FORM,
    name: '  My Story ',
    author: 'Me',
    password: 'secret-1',
    passwordConfirm: 'secret-1',
};

const create = (v: Partial<TStoryFormValue>) => validateStoryForm({ ...valid, ...v }, { passwordRequired: true });
const edit = (v: Partial<TStoryFormValue>) => validateStoryForm({ ...valid, ...v }, { passwordRequired: false });

describe('validateStoryForm', () => {
    it('accepts a complete form', () => {
        expect(create({})).toEqual({});
        expect(hasErrors(create({}))).toBe(false);
    });

    it('needs a name, within the limit', () => {
        expect(create({ name: '   ' }).name).toBeDefined();
        expect(create({ name: 'x'.repeat(STORY_LIMITS.nameMaxLength + 1) }).name).toBeDefined();
        expect(hasErrors(create({ name: '' }))).toBe(true);
    });

    it('needs a long enough password, typed twice the same', () => {
        expect(create({ password: '', passwordConfirm: '' }).password).toBeDefined();
        expect(create({ password: 'short', passwordConfirm: 'short' }).password).toBeDefined();
        expect(create({ passwordConfirm: 'secret-2' })).toEqual({
            passwordConfirm: 'The passwords do not match',
        });
    });

    it('needs each map side a whole number in range', () => {
        expect(create({ mapWidth: '' }).mapWidth).toBeDefined();
        expect(create({ mapWidth: '0' }).mapWidth).toBeDefined();
        expect(create({ mapHeight: '2.5' }).mapHeight).toBeDefined();
        expect(create({ mapHeight: String(STORY_LIMITS.mapSizeMax + 1) }).mapHeight).toBeDefined();
        expect(create({ mapWidth: '1', mapHeight: String(STORY_LIMITS.mapSizeMax) })).toEqual({});
    });

    it('takes an optional email, trimmed, of a valid form and length', () => {
        expect(create({ email: '' })).toEqual({});
        expect(create({ email: '  me@example.com ' })).toEqual({});
        expect(create({ email: 'nope' }).email).toBe('Not an email address');
        expect(create({ email: 'me@example' }).email).toBeDefined();
        const local = 'x'.repeat(STORY_LIMITS.emailMaxLength);
        expect(create({ email: `${local}@example.com` }).email).toBe(
            `At most ${STORY_LIMITS.emailMaxLength} characters`
        );
    });

    it('lets an edit keep the password by leaving both fields empty', () => {
        expect(edit({ password: '', passwordConfirm: '' })).toEqual({});
        expect(edit({ password: '', passwordConfirm: 'x' }).password).toBeDefined();
    });
});

describe('the bodies', () => {
    it('builds the create body: trimmed, numeric map size, no empty email', () => {
        expect(toCreateBody(valid)).toEqual({
            name: 'My Story',
            author: 'Me',
            password: 'secret-1',
            description: '',
            mapSize: { width: 40, height: 30 },
            public: false,
        });
        expect(toCreateBody({ ...valid, email: ' me@example.com ' }).email).toBe('me@example.com');
    });

    it('always sends the email on update, so it can be cleared', () => {
        expect(toUpdateBody({ ...valid, password: '', passwordConfirm: '' }, 'v1')).toEqual({
            version: 'v1',
            name: 'My Story',
            author: 'Me',
            email: '',
            description: '',
            public: false,
        });
        expect(toUpdateBody({ ...valid, email: ' me@example.com ' }, 'v1')).toMatchObject({
            email: 'me@example.com',
            password: 'secret-1',
        });
    });

    it('fills the form from the story info, without a password', () => {
        const info: TEditStoryInfoDto = {
            access: 'edit',
            id: 'story-1',
            name: 'My Story',
            author: 'Me',
            description: 'About',
            public: true,
            mapSize: { width: 12, height: 8 },
            version: 'v3',
            hasLandingImage: false,
            email: 'me@example.com',
        };
        expect(storyFormOf(info)).toEqual({
            name: 'My Story',
            author: 'Me',
            email: 'me@example.com',
            password: '',
            passwordConfirm: '',
            description: 'About',
            mapWidth: '12',
            mapHeight: '8',
            public: true,
        });
    });
});
