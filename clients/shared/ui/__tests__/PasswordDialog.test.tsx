import { afterEach, describe, expect, it, vi } from 'vitest';
import { PasswordDialog } from '../src/components/PasswordDialog';
import { buttonByText, cleanup, click, render, type } from './render';

afterEach(cleanup);

const statusError = (status: number, message: string) =>
    Object.assign(new Error(message), { status });

const open = (onRequestReset?: (email: string) => Promise<void>) =>
    render(
        <PasswordDialog
            open
            storyName="My Story"
            onSubmit={() => Promise.resolve()}
            onCancel={() => {}}
            onRequestReset={onRequestReset}
        />
    );

const text = () => document.body.textContent ?? '';

describe('PasswordDialog forgotten password', () => {
    it('is offered only with onRequestReset', () => {
        open();
        expect(text()).not.toContain('Forgotten password?');
    });

    it('sends the trimmed email and confirms it', async () => {
        const onRequestReset = vi.fn(() => Promise.resolve());
        open(onRequestReset);
        await click(buttonByText('Forgotten password?'));
        type('[data-field="email"]', ' me@example.com ');
        await click(buttonByText('Send link'));
        expect(onRequestReset).toHaveBeenCalledWith('me@example.com');
        expect(text()).toContain(
            "If me@example.com is the story's email, a link to set a new password was sent to it. It is valid for 12 hours."
        );
        await click(buttonByText('Back'));
        expect(text()).toContain('Unlock My Story');
    });

    it('shows a rate limit under the field', async () => {
        const onRequestReset = vi
            .fn<(email: string) => Promise<void>>()
            .mockRejectedValueOnce(statusError(429, 'Too Many Requests'));
        open(onRequestReset);
        await click(buttonByText('Forgotten password?'));
        type('[data-field="email"]', 'x@example.com');
        await click(buttonByText('Send link'));
        expect(text()).toContain(
            'Too many wrong attempts. Try again in a few minutes.'
        );
    });
});
