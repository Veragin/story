import { useState } from 'react';
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    Radio,
    RadioGroup,
    Stack,
    TextField,
} from '@mui/material';
import { observer } from 'mobx-react-lite';
import {
    GIT_DEFAULT_BRANCH,
    GIT_LIMITS,
    isGitBranchName,
    type TGitSetupMode,
} from '@story/protocol';
import { remoteUrlErrorMessage, showToast } from '@story/ui';
import { modals } from '../shell';
import { GitDisconnectPanel } from './GitDisconnectPanel';
import type { GitStore, TGitConfigPatch, TGitResult } from './GitStore';

type TProps = {
    store: GitStore;
    onClose: () => void;
};

const setupMode = (value: string): TGitSetupMode =>
    value === 'pull' ? 'pull' : 'push';

export const GitSettingsDialog = observer(({ store, onClose }: TProps) => {
    const config = store.config;
    const [remoteUrl, setRemoteUrl] = useState(config?.remoteUrl ?? '');
    const [branch, setBranch] = useState(config?.branch ?? GIT_DEFAULT_BRANCH);
    const [token, setToken] = useState('');
    const [authorName, setAuthorName] = useState(config?.authorName ?? '');
    const [authorEmail, setAuthorEmail] = useState(config?.authorEmail ?? '');
    const [initial, setInitial] = useState<TGitSetupMode>('push');
    const [touched, setTouched] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const urlError = remoteUrlErrorMessage(remoteUrl.trim());
    const branchError = isGitBranchName(branch.trim())
        ? null
        : _('Not a valid branch name');

    const finish = (result: TGitResult<unknown>, done: string) => {
        if (!result.ok) {
            setError(result.message);
            return;
        }
        showToast(done, { variant: 'success' });
        onClose();
    };

    const setup = async () => {
        if (initial === 'pull') {
            const confirmed = await modals.confirm({
                title: _('Replace this story?'),
                message: _(
                    "The story's files are replaced with the content of the repository. Changes made here that are not in the repository are lost."
                ),
                danger: true,
                confirmLabel: _('Replace'),
            });
            if (!confirmed) return;
        }
        const result = await store.setup({
            remoteUrl: remoteUrl.trim(),
            branch: branch.trim(),
            initial,
            ...(token ? { token } : {}),
            ...(authorName.trim() ? { authorName: authorName.trim() } : {}),
            ...(authorEmail.trim() ? { authorEmail: authorEmail.trim() } : {}),
        });
        finish(result, _('Git is set up'));
    };

    const update = async () => {
        if (!config) return;
        const patch: TGitConfigPatch = {
            ...(remoteUrl.trim() !== config.remoteUrl
                ? { remoteUrl: remoteUrl.trim() }
                : {}),
            ...(branch.trim() !== config.branch
                ? { branch: branch.trim() }
                : {}),
            ...(authorName.trim() !== config.authorName
                ? { authorName: authorName.trim() }
                : {}),
            ...(authorEmail.trim() !== config.authorEmail
                ? { authorEmail: authorEmail.trim() }
                : {}),
            ...(token ? { token } : {}),
        };
        const result = await store.saveConfig(patch);
        finish(result, _('Git settings saved'));
    };

    const submit = async () => {
        setTouched(true);
        if (urlError || branchError || store.busy) return;
        setError(null);
        await (config ? update() : setup());
    };

    const removeToken = async () => {
        setError(null);
        const result = await store.saveConfig({ token: null });
        if (!result.ok) setError(result.message);
    };

    const disconnect = async (removeRepo: boolean) => {
        setError(null);
        const result = await store.disconnect(removeRepo);
        finish(result, _('Git disconnected'));
    };

    return (
        <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    void submit();
                }}
            >
                <DialogTitle>
                    {config ? _('Git settings') : _('Set up git')}
                </DialogTitle>
                <DialogContent>
                    <Stack gap={2} sx={{ pt: 1 }}>
                        <TextField
                            autoFocus
                            required
                            label={_('Remote URL')}
                            placeholder="https://github.com/me/story.git"
                            value={remoteUrl}
                            onChange={(e) => setRemoteUrl(e.target.value)}
                            error={touched && urlError !== null}
                            helperText={touched ? urlError : null}
                            slotProps={{
                                htmlInput: {
                                    'aria-label': 'remote url',
                                    'spellCheck': false,
                                    'maxLength': GIT_LIMITS.remoteUrlMaxLength,
                                },
                            }}
                        />
                        <TextField
                            required
                            label={_('Branch')}
                            value={branch}
                            onChange={(e) => setBranch(e.target.value)}
                            error={touched && branchError !== null}
                            helperText={touched ? branchError : null}
                            slotProps={{
                                htmlInput: {
                                    'aria-label': 'branch',
                                    'spellCheck': false,
                                    'maxLength': GIT_LIMITS.branchMaxLength,
                                },
                            }}
                        />
                        <Stack direction="row" gap={1} alignItems="flex-start">
                            <TextField
                                fullWidth
                                type="password"
                                autoComplete="new-password"
                                label={_('Access token')}
                                placeholder={
                                    config?.hasToken
                                        ? _('unchanged')
                                        : _('none: a public repository')
                                }
                                value={token}
                                onChange={(e) => setToken(e.target.value)}
                                slotProps={{
                                    htmlInput: {
                                        'aria-label': 'token',
                                        'maxLength': GIT_LIMITS.tokenMaxLength,
                                    },
                                }}
                            />
                            {config?.hasToken && (
                                <Button
                                    color="inherit"
                                    disabled={store.busy}
                                    onClick={() => void removeToken()}
                                    sx={{ mt: 1, flexShrink: 0 }}
                                >
                                    {_('Remove token')}
                                </Button>
                            )}
                        </Stack>
                        <Alert severity="info">
                            {_(
                                'The token is stored encrypted on the server and is never shown again. Everyone with the story password pushes and pulls with it, so use a fine-grained token limited to this one repository (contents: read and write).'
                            )}
                        </Alert>
                        <Stack direction="row" gap={2}>
                            <TextField
                                fullWidth
                                label={_('Author name')}
                                placeholder={_("the story's author")}
                                value={authorName}
                                onChange={(e) => setAuthorName(e.target.value)}
                                slotProps={{
                                    htmlInput: {
                                        'aria-label': 'author name',
                                        'maxLength':
                                            GIT_LIMITS.authorNameMaxLength,
                                    },
                                }}
                            />
                            <TextField
                                fullWidth
                                label={_('Author email')}
                                placeholder="<story>@story.local"
                                value={authorEmail}
                                onChange={(e) => setAuthorEmail(e.target.value)}
                                slotProps={{
                                    htmlInput: {
                                        'aria-label': 'author email',
                                        'maxLength':
                                            GIT_LIMITS.authorEmailMaxLength,
                                    },
                                }}
                            />
                        </Stack>
                        {!config && (
                            <RadioGroup
                                value={initial}
                                onChange={(e) =>
                                    setInitial(setupMode(e.target.value))
                                }
                            >
                                <FormControlLabel
                                    value="push"
                                    control={<Radio />}
                                    label={_(
                                        'Upload this story to the repository'
                                    )}
                                />
                                <FormControlLabel
                                    value="pull"
                                    control={<Radio />}
                                    label={_(
                                        "Replace this story with the repository's content"
                                    )}
                                />
                            </RadioGroup>
                        )}
                        {config && disconnecting && (
                            <GitDisconnectPanel
                                busy={store.busy}
                                onDisconnect={(removeRepo) =>
                                    void disconnect(removeRepo)
                                }
                                onCancel={() => setDisconnecting(false)}
                            />
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
                    {config && !disconnecting && (
                        <Button
                            color="error"
                            onClick={() => setDisconnecting(true)}
                            sx={{ mr: 'auto' }}
                        >
                            {_('Disconnect…')}
                        </Button>
                    )}
                    <Button color="inherit" onClick={onClose}>
                        {_('Cancel')}
                    </Button>
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={store.busy}
                    >
                        {config ? _('Save') : _('Set up')}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
});
