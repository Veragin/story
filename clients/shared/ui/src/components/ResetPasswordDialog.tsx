import { useState, type FormEvent } from 'react';
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
} from '@mui/material';
import { STORY_LIMITS } from '@story/protocol';
import { LabeledTextField } from './LabeledTextField';
import { StackedAlert } from './StackedAlert';
import { resetPasswordErrorMessage } from './passwordErrorMessage';

type TProps = {
    storyName: string;
    title?: string;
    /** Resolve when the password is set; reject to keep the dialog open showing the error. */
    onSubmit: (password: string) => Promise<void>;
    onClose: () => void;
};

type TErrors = { password?: string; passwordConfirm?: string };

const L = STORY_LIMITS;

const validate = (password: string, passwordConfirm: string): TErrors => {
    if (password.length < L.passwordMinLength)
        return { password: _('At least %d characters', L.passwordMinLength) };
    if (password.length > L.passwordMaxLength)
        return { password: _('At most %d characters', L.passwordMaxLength) };
    if (passwordConfirm !== password)
        return { passwordConfirm: _('The passwords do not match') };
    return {};
};

export const ResetPasswordDialog = ({
    storyName,
    title,
    onSubmit,
    onClose,
}: TProps) => {
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const errors = submitted ? validate(password, passwordConfirm) : {};
    const invalid = Object.keys(errors).length > 0;

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitted(true);
        if (busy || Object.keys(validate(password, passwordConfirm)).length > 0)
            return;
        setBusy(true);
        setError(null);
        try {
            await onSubmit(password);
        } catch (err) {
            setError(resetPasswordErrorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog
            open
            onClose={busy ? undefined : onClose}
            maxWidth="xs"
            fullWidth
        >
            <form onSubmit={(e) => void submit(e)} noValidate>
                <DialogTitle>
                    {title ?? _('New password for %s', storyName)}
                </DialogTitle>
                <DialogContent>
                    <StackedAlert severity="info">
                        {_(
                            'Everyone logged in to this story will be logged out; you will be logged in with the new password.'
                        )}
                    </StackedAlert>
                    {error && (
                        <StackedAlert severity="error">{error}</StackedAlert>
                    )}
                    <Stack spacing={2}>
                        <LabeledTextField
                            type="password"
                            label={_('New password')}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            error={errors.password}
                            helperText={_(
                                'At least %d characters',
                                L.passwordMinLength
                            )}
                            disabled={busy}
                            autoComplete="new-password"
                            autoFocus
                            dataField="password"
                        />
                        <LabeledTextField
                            type="password"
                            label={_('Confirm password')}
                            value={passwordConfirm}
                            onChange={(e) => setPasswordConfirm(e.target.value)}
                            error={errors.passwordConfirm}
                            disabled={busy}
                            autoComplete="new-password"
                            dataField="passwordConfirm"
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button color="inherit" onClick={onClose} disabled={busy}>
                        {_('Cancel')}
                    </Button>
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={busy || invalid}
                        data-action="reset-password"
                    >
                        {busy ? _('Saving…') : _('Set password')}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};
