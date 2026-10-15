import type { ReactNode } from 'react';
import {
    Alert,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
} from '@mui/material';
import { StoryFormFields } from './StoryFormFields';
import {
    hasErrors,
    type TStoryFormErrors,
    type TStoryFormValue,
} from './storyForm';

type TProps = {
    title: string;
    mode: 'create' | 'edit';
    value: TStoryFormValue | null;
    onChange: (value: TStoryFormValue) => void;
    errors: TStoryFormErrors;
    submitted: boolean;
    saving: boolean;
    error: string | null;
    notice?: ReactNode;
    submitLabel: string;
    savingLabel: string;
    submitBlocked?: boolean;
    submitAction?: string;
    onSubmit: () => void;
    onClose: () => void;
};

export const StoryFormDialog = ({
    title,
    mode,
    value,
    onChange,
    errors,
    submitted,
    saving,
    error,
    notice,
    submitLabel,
    savingLabel,
    submitBlocked = false,
    submitAction,
    onSubmit,
    onClose,
}: TProps) => (
    <Dialog open onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent dividers>
            {notice}
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}
            {value ? (
                <StoryFormFields
                    value={value}
                    onChange={onChange}
                    errors={submitted ? errors : {}}
                    mode={mode}
                    disabled={saving}
                />
            ) : (
                !error && <CircularProgress size={24} />
            )}
        </DialogContent>
        <DialogActions>
            <Button color="inherit" onClick={onClose} disabled={saving}>
                {_('Cancel')}
            </Button>
            <Button
                variant="contained"
                onClick={onSubmit}
                disabled={
                    !value ||
                    saving ||
                    submitBlocked ||
                    (submitted && hasErrors(errors))
                }
                data-action={submitAction}
            >
                {saving ? savingLabel : submitLabel}
            </Button>
        </DialogActions>
    </Dialog>
);
