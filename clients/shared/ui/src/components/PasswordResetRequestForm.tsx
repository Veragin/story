import { useState, type FormEvent } from 'react';
import {
    Alert,
    Button,
    DialogActions,
    DialogContent,
    TextField,
} from '@mui/material';
import { STORY_LIMITS } from '@story/protocol';
import { resetRequestErrorMessage } from './passwordErrorMessage';

type TProps = {
    onRequestReset: (email: string) => Promise<void>;
    onBack: () => void;
};

export const PasswordResetRequestForm = ({
    onRequestReset,
    onBack,
}: TProps) => {
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [sentTo, setSentTo] = useState<string | null>(null);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        const trimmed = email.trim();
        if (trimmed === '' || busy) return;
        setBusy(true);
        setError(null);
        try {
            await onRequestReset(trimmed);
            setSentTo(trimmed);
        } catch (err) {
            setError(resetRequestErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    if (sentTo !== null) {
        return (
            <>
                <DialogContent>
                    <Alert severity="success">
                        {_(
                            'A link to set a new password was sent to %s. It is valid for 12 hours.',
                            sentTo
                        )}
                    </Alert>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onBack}>{_('Back')}</Button>
                </DialogActions>
            </>
        );
    }

    return (
        <form onSubmit={(e) => void submit(e)}>
            <DialogContent>
                <TextField
                    type="email"
                    label={_("The story's email")}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    error={error !== null}
                    helperText={
                        error ??
                        _('We will send a link to set a new password there.')
                    }
                    disabled={busy}
                    autoComplete="email"
                    autoFocus
                    fullWidth
                    margin="dense"
                    inputProps={{
                        'maxLength': STORY_LIMITS.emailMaxLength,
                        'data-field': 'email',
                    }}
                />
            </DialogContent>
            <DialogActions>
                <Button color="inherit" onClick={onBack} disabled={busy}>
                    {_('Back')}
                </Button>
                <Button
                    type="submit"
                    variant="contained"
                    disabled={email.trim() === '' || busy}
                >
                    {busy ? _('Sending…') : _('Send link')}
                </Button>
            </DialogActions>
        </form>
    );
};
