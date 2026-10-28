import { FormEvent, useEffect, useState } from 'react';
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    styled,
} from '@mui/material';
import { LabeledTextField } from './LabeledTextField';
import { passwordErrorMessage } from './passwordErrorMessage';
import { PasswordResetRequestForm } from './PasswordResetRequestForm';
import { StackedAlert } from './StackedAlert';

type Props = {
    open: boolean;
    storyName: string;
    title?: string;
    message?: string;
    /** Resolve to close (caller sets `open` false); reject to keep it open showing the error. */
    onSubmit: (password: string) => Promise<void>;
    onCancel: () => void;
    /** Offers "Forgotten password?": mails a reset link when `email` is the story's; reject to show the error. */
    onRequestReset?: (email: string) => Promise<void>;
};

export const PasswordDialog = ({
    open,
    storyName,
    title,
    message,
    onSubmit,
    onCancel,
    onRequestReset,
}: Props) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [resetting, setResetting] = useState(false);

    useEffect(() => {
        if (open) {
            setPassword('');
            setError(null);
            setBusy(false);
            setResetting(false);
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
            <DialogTitle>
                {resetting
                    ? _('Forgotten password for %s', storyName)
                    : (title ?? _('Unlock %s', storyName))}
            </DialogTitle>
            {resetting && onRequestReset ? (
                <PasswordResetRequestForm
                    onRequestReset={onRequestReset}
                    onBack={() => setResetting(false)}
                />
            ) : (
                <form onSubmit={(e) => void submit(e)}>
                    <DialogContent>
                        {message && (
                            <StackedAlert severity="info">
                                {message}
                            </StackedAlert>
                        )}
                        <LabeledTextField
                            type="password"
                            label={_('Password')}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            error={error}
                            disabled={busy}
                            autoComplete="current-password"
                            autoFocus
                            dataField="password"
                        />
                        {onRequestReset && (
                            <SLinkButton
                                size="small"
                                onClick={() => setResetting(true)}
                                disabled={busy}
                                data-action="forgotten-password"
                            >
                                {_('Forgotten password?')}
                            </SLinkButton>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button
                            color="inherit"
                            onClick={onCancel}
                            disabled={busy}
                        >
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
            )}
        </Dialog>
    );
};

const SLinkButton = styled(Button)`
    text-transform: none;
    padding-left: 0;
    padding-right: 0;
`;
