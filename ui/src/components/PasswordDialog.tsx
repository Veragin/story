import { FormEvent, useEffect, useState } from 'react';
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    TextField,
} from '@mui/material';
import { passwordErrorMessage } from './passwordErrorMessage';

type Props = {
    open: boolean;
    storyName: string;
    title?: string;
    message?: string;
    /** Resolve to close (caller sets `open` false); reject to keep it open showing the error. */
    onSubmit: (password: string) => Promise<void>;
    onCancel: () => void;
};

export const PasswordDialog = ({
    open,
    storyName,
    title,
    message,
    onSubmit,
    onCancel,
}: Props) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (open) {
            setPassword('');
            setError(null);
            setBusy(false);
        }
    }, [open]);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (password === '' || busy) return;
        setBusy(true);
        setError(null);
        try {
            await onSubmit(password);
        } catch (err) {
            setError(passwordErrorMessage(err));
            setPassword('');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={busy ? undefined : onCancel}
            maxWidth="xs"
            fullWidth
        >
            <form onSubmit={(e) => void submit(e)}>
                <DialogTitle>{title ?? _('Unlock %s', storyName)}</DialogTitle>
                <DialogContent>
                    {message && (
                        <Alert severity="info" sx={{ mb: 2 }}>
                            {message}
                        </Alert>
                    )}
                    <TextField
                        type="password"
                        label={_('Password')}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        error={error !== null}
                        helperText={error ?? ' '}
                        disabled={busy}
                        autoComplete="current-password"
                        autoFocus
                        fullWidth
                        margin="dense"
                    />
                </DialogContent>
                <DialogActions>
                    <Button color="inherit" onClick={onCancel} disabled={busy}>
                        {_('Cancel')}
                    </Button>
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={password === '' || busy}
                    >
                        {busy ? _('Unlocking…') : _('Unlock')}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};
