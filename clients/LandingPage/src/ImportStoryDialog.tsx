import { useState } from 'react';
import type { TImportStoryBody } from '@story/protocol';
import { errorMessage } from './api';
import { StoryFormDialog } from './StoryFormDialog';
import {
    hasErrors,
    importFormOf,
    toImportBody,
    validateStoryForm,
} from './storyForm';

type TProps = {
    fileName: string;
    onSubmit: (body: TImportStoryBody) => Promise<void>;
    onClose: () => void;
};

export const ImportStoryDialog = ({ fileName, onSubmit, onClose }: TProps) => {
    const [value, setValue] = useState(() => importFormOf(fileName));
    const [submitted, setSubmitted] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const errors = validateStoryForm(value, {
        passwordRequired: true,
        mapSize: false,
    });

    const submit = async () => {
        setSubmitted(true);
        if (hasErrors(errors)) return;
        setSaving(true);
        setError(null);
        try {
            await onSubmit(toImportBody(value));
        } catch (e) {
            setError(errorMessage(e));
            setSaving(false);
        }
    };

    return (
        <StoryFormDialog
            title={_('Import %s', fileName)}
            mode="import"
            value={value}
            onChange={setValue}
            errors={errors}
            submitted={submitted}
            saving={saving}
            error={error}
            submitLabel={_('Import')}
            savingLabel={_('Importing…')}
            submitAction="import"
            onSubmit={() => void submit()}
            onClose={onClose}
        />
    );
};
