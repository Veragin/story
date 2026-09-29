import { useState } from 'react';
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
} from '@mui/material';
import type { TCreateStoryBody } from '@story/visualizer-protocol';
import { StoryFormFields } from './StoryFormFields';
import {
    EMPTY_STORY_FORM,
    hasErrors,
    toCreateBody,
    validateStoryForm,
} from './storyForm';

type TProps = {
    /** Create the story; a rejection is shown in the dialog, which stays open. */
    onSubmit: (body: TCreateStoryBody) => Promise<void>;
    onClose: () => void;
};

/**
 * "New story": name, author, password (twice), description, map size, public. Errors show once
 * the user presses Create, and then update as they type.
 */
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
            setError((e as Error).message);
            setSaving(false);
        }
    };

    return (
        <Dialog
            open
            onClose={saving ? undefined : onClose}
            maxWidth="sm"
            fullWidth
        >
            <DialogTitle>{_('New story')}</DialogTitle>
            <DialogContent dividers>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}
                <StoryFormFields
                    value={value}
                    onChange={setValue}
                    errors={submitted ? errors : {}}
                    mode="create"
                    disabled={saving}
                />
            </DialogContent>
            <DialogActions>
                <Button color="inherit" onClick={onClose} disabled={saving}>
                    {_('Cancel')}
                </Button>
                <Button
                    variant="contained"
                    onClick={() => void create()}
                    disabled={saving || (submitted && hasErrors(errors))}
                    data-action="create"
                >
                    {saving ? _('Creating…') : _('Create')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
