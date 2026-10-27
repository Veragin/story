import { useState } from 'react';
import {
    Alert,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    Stack,
    Typography,
} from '@mui/material';
import { observer } from 'mobx-react-lite';
import {
    GIT_CHANGE_KINDS,
    GIT_LIMITS,
    type TApiErrorBody,
    type TGitChangeKind,
} from '@story/protocol';
import { LabeledTextField, showToast } from '@story/ui';
import { errorBodyMessage } from '../api';
import type { GitStore } from './GitStore';

type TProps = {
    store: GitStore;
    onClose: () => void;
    onCommitted: () => void;
};

const KIND_LABELS: Record<TGitChangeKind, () => string> = {
    added: () => _('Added'),
    modified: () => _('Modified'),
    deleted: () => _('Deleted'),
    renamed: () => _('Renamed'),
};

export const GitCommitDialog = observer(
    ({ store, onClose, onCommitted }: TProps) => {
        const [message, setMessage] = useState('');
        const [push, setPush] = useState(true);
        const [error, setError] = useState<string | null>(null);
        const [pushError, setPushError] = useState<TApiErrorBody | null>(null);

        const changes = store.status?.changes ?? [];
        const trimmed = message.trim();
        const committed = pushError !== null;
        const close = committed ? onCommitted : onClose;

        const commit = async () => {
            if (!trimmed || store.busy) return;
            setError(null);
            const result = await store.commit(trimmed, push);
            if (!result.ok) {
                setError(result.message);
                return;
            }
            if (result.value.pushError) {
                setPushError(result.value.pushError);
                return;
            }
            showToast(
                result.value.pushed
                    ? _('Committed and pushed')
                    : _('Committed'),
                {
                    variant: 'success',
                }
            );
            onCommitted();
        };

        const pullThenPush = async () => {
            setError(null);
            const result = await store.pullThenPush();
            if (!result.ok) {
                setError(result.message);
                return;
            }
            showToast(_('Pulled and pushed'), { variant: 'success' });
            onCommitted();
        };

        return (
            <Dialog open onClose={close} maxWidth="sm" fullWidth>
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        void commit();
                    }}
                >
                    <DialogTitle>{_('Commit & push')}</DialogTitle>
                    <DialogContent>
                        <Stack gap={2} sx={{ pt: 1 }}>
                            {committed ? (
                                <Alert
                                    severity="warning"
                                    sx={{ whiteSpace: 'pre-wrap' }}
                                >
                                    {_(
                                        'Committed locally, but the push failed: %s',
                                        errorBodyMessage(pushError)
                                    )}
                                </Alert>
                            ) : (
                                <>
                                    {changes.length === 0 && (
                                        <Alert severity="info">
                                            {_('There is nothing to commit.')}
                                        </Alert>
                                    )}
                                    {GIT_CHANGE_KINDS.map((kind) => {
                                        const files = changes.filter(
                                            (c) => c.kind === kind
                                        );
                                        if (files.length === 0) return null;
                                        return (
                                            <div key={kind} data-kind={kind}>
                                                <Typography variant="overline">
                                                    {KIND_LABELS[kind]()} (
                                                    {files.length})
                                                </Typography>
                                                {files.map((c) => (
                                                    <Typography
                                                        key={c.path}
                                                        variant="body2"
                                                        sx={{
                                                            fontFamily:
                                                                'monospace',
                                                        }}
                                                    >
                                                        {c.path}
                                                    </Typography>
                                                ))}
                                            </div>
                                        );
                                    })}
                                    <LabeledTextField
                                        autoFocus
                                        required
                                        multiline
                                        minRows={2}
                                        label={_('Message')}
                                        value={message}
                                        onChange={(e) =>
                                            setMessage(e.target.value)
                                        }
                                        slotProps={{
                                            htmlInput: {
                                                'aria-label': 'message',
                                                'maxLength':
                                                    GIT_LIMITS.messageMaxLength,
                                            },
                                        }}
                                    />
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={push}
                                                onChange={(e) =>
                                                    setPush(e.target.checked)
                                                }
                                                inputProps={{
                                                    'aria-label': 'push',
                                                }}
                                            />
                                        }
                                        label={_('Push after commit')}
                                    />
                                </>
                            )}
                            {error && (
                                <Alert
                                    severity="error"
                                    sx={{ whiteSpace: 'pre-wrap' }}
                                >
                                    {error}
                                </Alert>
                            )}
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button color="inherit" onClick={close}>
                            {committed ? _('Close') : _('Cancel')}
                        </Button>
                        {committed ? (
                            pushError.error === 'git_rejected' && (
                                <Button
                                    variant="contained"
                                    disabled={store.busy}
                                    onClick={() => void pullThenPush()}
                                >
                                    {_('Pull then push')}
                                </Button>
                            )
                        ) : (
                            <Button
                                type="submit"
                                variant="contained"
                                disabled={
                                    store.busy ||
                                    !trimmed ||
                                    changes.length === 0
                                }
                            >
                                {push ? _('Commit & push') : _('Commit')}
                            </Button>
                        )}
                    </DialogActions>
                </form>
            </Dialog>
        );
    }
);
