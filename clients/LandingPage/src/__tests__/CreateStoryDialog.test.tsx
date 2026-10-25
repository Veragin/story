import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import {
    GIT_DEFAULT_BRANCH,
    STORY_LIMITS,
    type TCreateStoryBody,
    type TGitConfigDto,
    type TSetupGitBody,
} from '@story/protocol';
import { CreateStoryDialog } from '../CreateStoryDialog';
import {
    EMPTY_STORY_FORM,
    toCreateBody,
    toGitChange,
    toUpdateBody,
    validateStoryForm,
    type TStoryFormValue,
    type TStoryGitState,
} from '../storyForm';

const valid: TStoryFormValue = {
    ...EMPTY_STORY_FORM,
    name: '  My Story ',
    author: 'Me',
    password: 'secret-1',
    passwordConfirm: 'secret-1',
};

const CONFIG: TGitConfigDto = {
    remoteUrl: 'https://example.com/me/story.git',
    branch: 'main',
    hasToken: true,
    authorName: 'Me',
    authorEmail: 'me@story.local',
    version: '3',
};

describe('the git fields', () => {
    const NEW: TStoryGitState = { config: null };
    const CONNECTED: TStoryGitState = { config: CONFIG };
    const errors = (v: Partial<TStoryFormValue>, git: TStoryGitState) =>
        validateStoryForm({ ...valid, ...v }, { passwordRequired: true, git });

    it('are optional for a story not yet connected', () => {
        expect(errors({}, NEW)).toEqual({});
        expect(toGitChange(valid, NEW)).toBeNull();
    });

    it('want an https URL without credentials, and a URL for a token', () => {
        expect(
            errors({ gitRemoteUrl: 'git@host:me/x.git' }, NEW).gitRemoteUrl
        ).toBeDefined();
        expect(
            errors({ gitRemoteUrl: 'http://example.com/x.git' }, NEW)
                .gitRemoteUrl
        ).toBe('Use an https:// URL');
        expect(
            errors({ gitRemoteUrl: 'https://me:tkn@example.com/x.git' }, NEW)
                .gitRemoteUrl
        ).toBeDefined();
        expect(errors({ gitToken: 'tkn' }, NEW).gitRemoteUrl).toBeDefined();
    });

    it('cannot clear the URL of a connected story', () => {
        expect(
            errors({ ...valid, gitRemoteUrl: CONFIG.remoteUrl }, CONNECTED)
        ).toEqual({});
        expect(
            errors({ gitRemoteUrl: '' }, CONNECTED).gitRemoteUrl
        ).toBeDefined();
    });

    it('are ignored without git on the server', () => {
        expect(
            errors({ gitRemoteUrl: 'nonsense', gitToken: 'x' }, null)
        ).toEqual({});
        expect(
            toGitChange({ ...valid, gitRemoteUrl: 'https://e.com/x.git' }, null)
        ).toBeNull();
    });

    it('set up a new connection by pushing the story to the default branch', () => {
        expect(
            toGitChange(
                {
                    ...valid,
                    gitRemoteUrl: ' https://e.com/x.git ',
                    gitToken: 'tkn',
                },
                NEW
            )
        ).toEqual({
            kind: 'setup',
            body: {
                remoteUrl: 'https://e.com/x.git',
                branch: GIT_DEFAULT_BRANCH,
                initial: 'push',
                token: 'tkn',
            },
        });
        expect(
            toGitChange({ ...valid, gitRemoteUrl: 'https://e.com/x.git' }, NEW)
        ).toEqual({
            kind: 'setup',
            body: {
                remoteUrl: 'https://e.com/x.git',
                branch: GIT_DEFAULT_BRANCH,
                initial: 'push',
            },
        });
    });

    it('update only what changed of a connection, an empty token keeping the stored one', () => {
        const same = { ...valid, gitRemoteUrl: CONFIG.remoteUrl };
        expect(toGitChange(same, CONNECTED)).toBeNull();
        expect(toGitChange({ ...same, gitToken: 'new' }, CONNECTED)).toEqual({
            kind: 'update',
            body: { version: '3', token: 'new' },
        });
        expect(
            toGitChange(
                { ...same, gitRemoteUrl: 'https://e.com/y.git' },
                CONNECTED
            )
        ).toEqual({
            kind: 'update',
            body: { version: '3', remoteUrl: 'https://e.com/y.git' },
        });
    });
});

describe('validateStoryForm', () => {
    const create = (v: Partial<TStoryFormValue>) =>
        validateStoryForm({ ...valid, ...v }, { passwordRequired: true });

    it('accepts a complete form', () => {
        expect(create({})).toEqual({});
    });

    it('needs a name, within the limit', () => {
        expect(create({ name: '   ' }).name).toBeDefined();
        expect(
            create({ name: 'x'.repeat(STORY_LIMITS.nameMaxLength + 1) }).name
        ).toBeDefined();
    });

    it('needs a long enough password, typed twice the same', () => {
        expect(
            create({ password: '', passwordConfirm: '' }).password
        ).toBeDefined();
        expect(
            create({ password: 'short', passwordConfirm: 'short' }).password
        ).toBeDefined();
        expect(create({ passwordConfirm: 'secret-2' })).toEqual({
            passwordConfirm: 'The passwords do not match',
        });
    });

    it('needs each map side a whole number in range', () => {
        expect(create({ mapWidth: '' }).mapWidth).toBeDefined();
        expect(create({ mapWidth: '0' }).mapWidth).toBeDefined();
        expect(create({ mapHeight: '2.5' }).mapHeight).toBeDefined();
        expect(
            create({ mapHeight: String(STORY_LIMITS.mapSizeMax + 1) }).mapHeight
        ).toBeDefined();
        expect(
            create({
                mapWidth: '1',
                mapHeight: String(STORY_LIMITS.mapSizeMax),
            })
        ).toEqual({});
    });

    it('lets an edit keep the password by leaving both fields empty', () => {
        const edit = (v: Partial<TStoryFormValue>) =>
            validateStoryForm({ ...valid, ...v }, { passwordRequired: false });
        expect(edit({ password: '', passwordConfirm: '' })).toEqual({});
        expect(
            edit({ password: '', passwordConfirm: 'x' }).password
        ).toBeDefined();
        expect(
            toUpdateBody({ ...valid, password: '', passwordConfirm: '' }, 'v1')
        ).not.toHaveProperty('password');
    });

    it('builds the create body: trimmed, numeric map size', () => {
        expect(toCreateBody(valid)).toEqual({
            name: 'My Story',
            author: 'Me',
            password: 'secret-1',
            description: '',
            mapSize: { width: 40, height: 30 },
            public: false,
        });
    });
});

let root: Root | null = null;

afterEach(() => {
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = '';
});

const renderDialog = (dialog: ReactNode) => {
    const container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
    act(() => root!.render(dialog));
};

const input = (field: keyof TStoryFormValue) =>
    document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `[data-field="${field}"]`
    );

// React tracks controlled values; bypass via the native setter so `input` registers
const type = (field: keyof TStoryFormValue, value: string) => {
    const el = input(field)!;
    const setter = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(el),
        'value'
    )!.set!;
    act(() => {
        setter.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
    });
};

describe('CreateStoryDialog', () => {
    const render = (
        onSubmit: (
            body: TCreateStoryBody,
            git: TSetupGitBody | null
        ) => Promise<void>,
        gitAvailable = false
    ) =>
        renderDialog(
            <CreateStoryDialog
                gitAvailable={gitAvailable}
                onSubmit={onSubmit}
                onClose={() => {}}
            />
        );

    const createButton = () =>
        document.querySelector<HTMLButtonElement>('[data-action="create"]')!;

    it('shows the errors on Create and does not submit an invalid form', () => {
        const onSubmit = vi.fn(() => Promise.resolve());
        render(onSubmit);
        expect(document.body.textContent).not.toContain('The name is required');

        act(() => createButton().click());
        expect(onSubmit).not.toHaveBeenCalled();
        expect(document.body.textContent).toContain('The name is required');
        expect(document.body.textContent).toContain(
            `At least ${STORY_LIMITS.passwordMinLength} characters`
        );
        expect(createButton().disabled).toBe(true);

        type('name', 'My Story');
        type('password', 'secret-1');
        type('passwordConfirm', 'secret-2');
        expect(document.body.textContent).toContain(
            'The passwords do not match'
        );
        expect(createButton().disabled).toBe(true);
    });

    it('submits a valid form as a create body', async () => {
        const onSubmit = vi.fn(() => Promise.resolve());
        render(onSubmit);
        type('name', 'My Story');
        type('author', 'Me');
        type('password', 'secret-1');
        type('passwordConfirm', 'secret-1');
        type('mapWidth', '12');
        await act(() => Promise.resolve(createButton().click()));
        expect(onSubmit).toHaveBeenCalledWith(
            {
                name: 'My Story',
                author: 'Me',
                password: 'secret-1',
                description: '',
                mapSize: { width: 12, height: 30 },
                public: false,
            },
            null
        );
    });

    it('hides the git fields when the server has no git', () => {
        render(() => Promise.resolve());
        expect(input('gitRemoteUrl')).toBeNull();
        expect(input('gitToken')).toBeNull();
    });

    it('submits the repository URL and token as a git setup', async () => {
        const onSubmit = vi.fn(() => Promise.resolve());
        render(onSubmit, true);
        type('name', 'My Story');
        type('password', 'secret-1');
        type('passwordConfirm', 'secret-1');
        type('gitRemoteUrl', 'https://example.com/me/story.git');
        type('gitToken', 'tkn');
        await act(() => Promise.resolve(createButton().click()));
        expect(onSubmit).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'My Story' }),
            {
                remoteUrl: 'https://example.com/me/story.git',
                branch: GIT_DEFAULT_BRANCH,
                initial: 'push',
                token: 'tkn',
            }
        );
        expect(input('gitToken')!.getAttribute('type')).toBe('password');
    });

    it('shows a rejected create in the dialog', async () => {
        render(() =>
            Promise.reject(new Error('Field "name" must not be empty'))
        );
        type('name', 'My Story');
        type('password', 'secret-1');
        type('passwordConfirm', 'secret-1');
        await act(() => Promise.resolve(createButton().click()));
        expect(document.body.textContent).toContain(
            'Field "name" must not be empty'
        );
        expect(createButton().disabled).toBe(false);
    });
});
