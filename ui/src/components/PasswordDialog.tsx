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
    /** The story being unlocked, shown in the default title ("Unlock <storyName>"). */
    storyName: string;
    /** Replaces the default title. */
    title?: string;
    /** A line above the field, e.g. why the password is needed. */
    message?: string;
    /**
     * Log in with the password. Resolve to close (the caller sets `open` to false); reject to keep
     * the dialog open with the error shown under the field. See `passwordErrorMessage` for how
     * the error is worded.
     */
    onSubmit: (password: string) => Promise<void>;
    onCancel: () => void;
};

/**
 * The story password prompt (multiple stories): the landing page asks it before Edit / Open /
 * Export (and Play of a private story), the Visualizer client and SingleEngine when the server
 * answers 401. It only collects the password; logging in is the caller's `onSubmit`, so this knows
 * nothing about the API.
 *
 *     <PasswordDialog
 *         open={prompt !== null}
 *         storyName={prompt.name}
 *         onSubmit={(password) => api.login(prompt.id, password)}
 *         onCancel={() => setPrompt(null)}
 *     />
 */
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

    // Every opening starts empty: a password must not linger for the next story.
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
