import { useState } from 'react';
import type { TCreateStoryBody, TSetupGitBody } from '@story/protocol';
import { errorMessage } from './api';
import { StoryFormDialog } from './StoryFormDialog';
import {
    EMPTY_STORY_FORM,
    hasErrors,
    toCreateBody,
    toGitChange,
    validateStoryForm,
    type TStoryGitState,
} from './storyForm';

type TProps = {
    gitAvailable: boolean;
    onSubmit: (
        body: TCreateStoryBody,
        git: TSetupGitBody | null
    ) => Promise<void>;
    onClose: () => void;
};

export const CreateStoryDialog = ({
    gitAvailable,
    onSubmit,
    onClose,
}: TProps) => {
    const [value, setValue] = useState(EMPTY_STORY_FORM);
    const [submitted, setSubmitted] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const git: TStoryGitState = gitAvailable ? { config: null } : null;
    const errors = validateStoryForm(value, { passwordRequired: true, git });

    const create = async () => {
        setSubmitted(true);
        if (hasErrors(errors)) return;
        setSaving(true);
        setError(null);
        try {
            const change = toGitChange(value, git);
            await onSubmit(
                toCreateBody(value),
                change?.kind === 'setup' ? change.body : null
            );
        } catch (e) {
            setError(errorMessage(e));
            setSaving(false);
        }
    };

    return (
        <StoryFormDialog
            title={_('New story')}
            mode="create"
            git={git}
            value={value}
            onChange={setValue}
            errors={errors}
            submitted={submitted}
            saving={saving}
            error={error}
            submitLabel={_('Create')}
            savingLabel={_('Creating…')}
            submitAction="create"
            onSubmit={() => void create()}
            onClose={onClose}
        />
    );
};
