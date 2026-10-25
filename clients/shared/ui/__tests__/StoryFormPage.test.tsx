import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STORY_LIMITS, type TCreateStoryBody } from '@story/protocol';
import { StoryFormFields } from '../src/components/storyForm/StoryFormFields';
import { StoryFormPage } from '../src/components/storyForm/StoryFormPage';
import {
    EMPTY_STORY_FORM,
    hasErrors,
    toCreateBody,
    validateStoryForm,
} from '../src/components/storyForm/storyForm';
import { buttonByText, cleanup, click, element, render, type } from './render';

afterEach(cleanup);

const CreatePage = ({
    onSubmit,
    onClose,
}: {
    onSubmit: (body: TCreateStoryBody) => void;
    onClose: () => void;
}) => {
    const [value, setValue] = useState(EMPTY_STORY_FORM);
    const [submitted, setSubmitted] = useState(false);
    const errors = validateStoryForm(value, { passwordRequired: true });
    const submit = () => {
        setSubmitted(true);
        if (!hasErrors(errors)) onSubmit(toCreateBody(value));
    };
    return (
        <StoryFormPage
            title="New story"
            saving={false}
            submitLabel="Create"
            savingLabel="Creating…"
            submitBlocked={submitted && hasErrors(errors)}
            submitAction="create"
            onSubmit={submit}
            onClose={onClose}
        >
            <StoryFormFields
                value={value}
                onChange={setValue}
                errors={submitted ? errors : {}}
                mode="create"
            />
        </StoryFormPage>
    );
};

const createButton = () => element('[data-action="create"]', HTMLButtonElement);

describe('StoryFormPage with StoryFormFields', () => {
    it('shows the errors on submit and blocks it until they are fixed', async () => {
        const onSubmit = vi.fn();
        render(<CreatePage onSubmit={onSubmit} onClose={() => {}} />);
        expect(document.body.textContent).not.toContain('The name is required');

        await click(createButton());
        expect(onSubmit).not.toHaveBeenCalled();
        expect(document.body.textContent).toContain('The name is required');
        expect(document.body.textContent).toContain(
            `At least ${STORY_LIMITS.passwordMinLength} characters`
        );
        expect(createButton().disabled).toBe(true);

        type('[data-field="email"]', 'nope');
        expect(document.body.textContent).toContain('Not an email address');
    });

    it('submits a valid form with its email', async () => {
        const onSubmit = vi.fn();
        render(<CreatePage onSubmit={onSubmit} onClose={() => {}} />);
        type('[data-field="name"]', 'My Story');
        type('[data-field="email"]', 'me@example.com');
        type('[data-field="password"]', 'secret-1');
        type('[data-field="passwordConfirm"]', 'secret-1');
        await click(createButton());
        expect(onSubmit).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'My Story',
                email: 'me@example.com',
            })
        );
        expect(element('[data-field="email"]', HTMLInputElement).type).toBe(
            'email'
        );
        expect(document.body.textContent).toContain(
            'Optional. Used as the author email of git commits and to reset a forgotten password.'
        );
    });

    it('closes from both Back and Cancel', async () => {
        const onClose = vi.fn();
        render(<CreatePage onSubmit={() => {}} onClose={onClose} />);
        await click(buttonByText('Back'));
        await click(buttonByText('Cancel'));
        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('shows the saving label and the error', () => {
        render(
            <StoryFormPage
                title="Settings"
                error="Something failed"
                saving
                submitLabel="Save"
                savingLabel="Saving…"
                onSubmit={() => {}}
                onClose={() => {}}
            >
                <p>body</p>
            </StoryFormPage>
        );
        expect(document.body.textContent).toContain('Something failed');
        expect(buttonByText('Saving…').disabled).toBe(true);
    });
});
