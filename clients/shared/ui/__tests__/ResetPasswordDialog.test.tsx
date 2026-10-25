import { afterEach, describe, expect, it, vi } from 'vitest';
import { STORY_LIMITS } from '@story/protocol';
import { ResetPasswordDialog } from '../src/components/ResetPasswordDialog';
import { cleanup, click, element, render, type } from './render';

afterEach(cleanup);

const text = () => document.body.textContent ?? '';
const setButton = () =>
    element('[data-action="reset-password"]', HTMLButtonElement);

describe('ResetPasswordDialog', () => {
    it('warns that everyone else is logged out', () => {
        render(
            <ResetPasswordDialog
                storyName="My Story"
                onSubmit={() => Promise.resolve()}
                onClose={() => {}}
            />
        );
        expect(text()).toContain('New password for My Story');
        expect(text()).toContain(
            'Everyone logged in to this story will be logged out'
        );
    });

    it('checks the length and the confirmation before submitting', async () => {
        const onSubmit = vi.fn(() => Promise.resolve());
        render(
            <ResetPasswordDialog
                storyName="My Story"
                onSubmit={onSubmit}
                onClose={() => {}}
            />
        );
        type('[data-field="password"]', 'short');
        await click(setButton());
        expect(text()).toContain(
            `At least ${STORY_LIMITS.passwordMinLength} characters`
        );
        type('[data-field="password"]', 'secret-1');
        type('[data-field="passwordConfirm"]', 'secret-2');
        expect(text()).toContain('The passwords do not match');
        expect(onSubmit).not.toHaveBeenCalled();

        type('[data-field="passwordConfirm"]', 'secret-1');
        await click(setButton());
        expect(onSubmit).toHaveBeenCalledWith('secret-1');
    });

    it('shows the server error inline', async () => {
        render(
            <ResetPasswordDialog
                storyName="My Story"
                onSubmit={() =>
                    Promise.reject(
                        new Error('The link is invalid or has expired')
                    )
                }
                onClose={() => {}}
            />
        );
        type('[data-field="password"]', 'secret-1');
        type('[data-field="passwordConfirm"]', 'secret-1');
        await click(setButton());
        expect(text()).toContain('The link is invalid or has expired');
        expect(setButton().disabled).toBe(false);
    });
});
