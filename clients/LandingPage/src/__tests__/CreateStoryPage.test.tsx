import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    GIT_DEFAULT_BRANCH,
    STORY_LIMITS,
    type TCreateStoryBody,
    type TSetupGitBody,
} from '@story/protocol';
import { CreateStoryPage } from '../CreateStoryPage';
import {
    EMPTY_GIT_CONNECT,
    toGitSetup,
    validateGitConnect,
} from '../gitConnectForm';

describe('gitConnectForm', () => {
    const errors = (remoteUrl: string, token = '') =>
        validateGitConnect({ remoteUrl, token });

    it('is optional', () => {
        expect(validateGitConnect(EMPTY_GIT_CONNECT)).toEqual({});
        expect(toGitSetup(EMPTY_GIT_CONNECT)).toBeNull();
    });

    it('wants an https URL without credentials, and a URL for a token', () => {
        expect(errors('git@host:me/x.git').remoteUrl).toBeDefined();
        expect(errors('http://example.com/x.git').remoteUrl).toBe(
            'Use an https:// URL'
        );
        expect(
            errors('https://me:tkn@example.com/x.git').remoteUrl
        ).toBeDefined();
        expect(errors('', 'tkn').remoteUrl).toBeDefined();
        expect(errors('https://example.com/x.git', 'tkn')).toEqual({});
    });

    it('sets up a connection by pushing the story to the default branch', () => {
        expect(
            toGitSetup({ remoteUrl: ' https://e.com/x.git ', token: 'tkn' })
        ).toEqual({
            remoteUrl: 'https://e.com/x.git',
            branch: GIT_DEFAULT_BRANCH,
            initial: 'push',
            token: 'tkn',
        });
        expect(
            toGitSetup({ remoteUrl: 'https://e.com/x.git', token: '' })
        ).toEqual({
            remoteUrl: 'https://e.com/x.git',
            branch: GIT_DEFAULT_BRANCH,
            initial: 'push',
        });
    });
});

let root: Root | null = null;

afterEach(() => {
    act(() => root?.unmount());
    root = null;
    document.body.innerHTML = '';
});

const findInput = (field: string) =>
    document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `[data-field="${field}"]`
    );

const input = (field: string) => {
    const el = findInput(field);
    if (!el) throw new Error(`No field ${field}`);
    return el;
};

// React tracks controlled values; bypass via the native setter so `input` registers
const type = (field: string, value: string) => {
    const el = input(field);
    const setter = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(el),
        'value'
    )?.set;
    if (!setter) throw new Error('No value setter');
    act(() => {
        setter.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
    });
};

const createButton = () => {
    const button = document.querySelector<HTMLButtonElement>(
        '[data-action="create"]'
    );
    if (!button) throw new Error('No create button');
    return button;
};

const fillValid = () => {
    type('name', 'My Story');
    type('password', 'secret-1');
    type('passwordConfirm', 'secret-1');
};

type TSubmit = (
    body: TCreateStoryBody,
    git: TSetupGitBody | null
) => Promise<void>;

describe('CreateStoryPage', () => {
    const render = (
        onSubmit: TSubmit,
        gitAvailable = false,
        onClose = () => {}
    ) => {
        const container = document.body.appendChild(
            document.createElement('div')
        );
        const created = createRoot(container);
        root = created;
        act(() =>
            created.render(
                <CreateStoryPage
                    gitAvailable={gitAvailable}
                    onSubmit={onSubmit}
                    onClose={onClose}
                />
            )
        );
    };

    it('shows the errors on Create and does not submit an invalid form', () => {
        const onSubmit = vi.fn<TSubmit>(() => Promise.resolve());
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
        const onSubmit = vi.fn<TSubmit>(() => Promise.resolve());
        render(onSubmit);
        fillValid();
        type('author', 'Me');
        type('email', ' me@story.cz ');
        type('mapWidth', '12');
        await act(() => Promise.resolve(createButton().click()));
        expect(onSubmit).toHaveBeenCalledWith(
            {
                name: 'My Story',
                author: 'Me',
                email: 'me@story.cz',
                password: 'secret-1',
                description: '',
                mapSize: { width: 12, height: 30 },
                public: false,
            },
            null
        );
    });

    it('hides the git section when the server has no git', () => {
        render(() => Promise.resolve());
        expect(document.body.textContent).not.toContain('Git repository');
        expect(findInput('gitRemoteUrl')).toBeNull();
        expect(findInput('gitToken')).toBeNull();
    });

    it('submits the repository URL and token as a git setup', async () => {
        const onSubmit = vi.fn<TSubmit>(() => Promise.resolve());
        render(onSubmit, true);
        expect(document.body.textContent).toContain('Not connected');
        fillValid();
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
        expect(input('gitToken').getAttribute('type')).toBe('password');
    });

    it('expands the git section to show its error and does not submit', () => {
        const onSubmit = vi.fn<TSubmit>(() => Promise.resolve());
        render(onSubmit, true);
        fillValid();
        type('gitToken', 'tkn');
        act(() => createButton().click());
        expect(onSubmit).not.toHaveBeenCalled();
        expect(document.body.textContent).toContain(
            'The token needs a repository URL'
        );
        expect(document.querySelector('[aria-expanded="true"]')).not.toBeNull();
    });

    it('shows a rejected create on the page', async () => {
        render(() =>
            Promise.reject(new Error('Field "name" must not be empty'))
        );
        fillValid();
        await act(() => Promise.resolve(createButton().click()));
        expect(document.body.textContent).toContain(
            'Field "name" must not be empty'
        );
        expect(createButton().disabled).toBe(false);
    });

    it('goes back on Back', () => {
        const onClose = vi.fn();
        render(() => Promise.resolve(), false, onClose);
        act(() =>
            document
                .querySelector<HTMLButtonElement>('[data-action="back"]')
                ?.click()
        );
        expect(onClose).toHaveBeenCalled();
    });
});
