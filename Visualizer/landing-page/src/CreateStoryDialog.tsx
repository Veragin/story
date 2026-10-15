import { useState } from 'react';
import type { TCreateStoryBody } from '@story/visualizer-protocol';
import { errorMessage } from './api';
import { StoryFormDialog } from './StoryFormDialog';
import {
    EMPTY_STORY_FORM,
    hasErrors,
    toCreateBody,
    validateStoryForm,
} from './storyForm';

type TProps = {
    onSubmit: (body: TCreateStoryBody) => Promise<void>;
    onClose: () => void;
};

export const CreateStoryDialog = ({ onSubmit, onClose }: TProps) => {
    const [value, setValue] = useState(EMPTY_STORY_FORM);
    const [submitted, setSubmitted] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const errors = validateStoryForm(value, { passwordRequired: true });

    const create = async () => {
        setSubmitted(true);
        if (hasErrors(errors)) return;
        setSaving(true);
        setError(null);
        try {
            await onSubmit(toCreateBody(value));
        } catch (e) {
            setError(errorMessage(e));
            setSaving(false);
        }
    };

    return (
        <StoryFormDialog
            title={_('New story')}
            mode="create"
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
