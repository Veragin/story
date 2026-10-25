import { useState } from 'react';
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
} from '@mui/material';
import { errorMessage } from './api';

type TProps = {
    storyName: string;
    fileName: string;
    onSubmit: () => Promise<void>;
    onClose: () => void;
};

export const AddStoryFilesDialog = ({
    storyName,
    fileName,
    onSubmit,
    onClose,
}: TProps) => {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async () => {
        setSaving(true);
        setError(null);
        try {
            await onSubmit();
        } catch (e) {
            setError(errorMessage(e));
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
            <DialogTitle>{_('Import %s', fileName)}</DialogTitle>
            <DialogContent dividers>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}
                <DialogContentText>
                    {_(
                        'The files in the zip are added to "%s". Files of the same path are replaced.',
                        storyName
                    )}
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button color="inherit" onClick={onClose} disabled={saving}>
                    {_('Cancel')}
                </Button>
                <Button
                    variant="contained"
                    onClick={() => void submit()}
                    disabled={saving}
                    data-action="import"
                >
                    {saving ? _('Importing…') : _('Import')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
