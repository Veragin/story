import { useState } from 'react';
import {
    Alert,
    Button,
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
import { LabeledTextField, remoteUrlErrorMessage, showToast } from '@story/ui';
import { FormLabel } from '../components/form/FormLabel';
import { modals } from '../shell';
import { GitDisconnectPanel } from './GitDisconnectPanel';
import type { GitStore, TGitConfigPatch, TGitResult } from './GitStore';

type TProps = {
    store: GitStore;
};

const setupMode = (value: string): TGitSetupMode =>
    value === 'pull' ? 'pull' : 'push';

export const GitSettingsForm = observer(({ store }: TProps) => {
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
        <form
            data-form="git-settings"
            onSubmit={(e) => {
                e.preventDefault();
                void submit();
            }}
        >
            <Stack gap={2}>
                <LabeledTextField
                    required
                    label={_('Remote URL')}
                    placeholder="https://github.com/me/story.git"
                    value={remoteUrl}
                    onChange={(e) => setRemoteUrl(e.target.value)}
                    error={touched ? urlError : null}
                    slotProps={{
                        htmlInput: {
                            'aria-label': 'remote url',
                            'spellCheck': false,
                            'maxLength': GIT_LIMITS.remoteUrlMaxLength,
                        },
                    }}
                />
                <LabeledTextField
                    required
                    label={_('Branch')}
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    error={touched ? branchError : null}
                    slotProps={{
                        htmlInput: {
                            'aria-label': 'branch',
                            'spellCheck': false,
                            'maxLength': GIT_LIMITS.branchMaxLength,
                        },
                    }}
                />
                <FormLabel label={_('Access token')}>
                    <Stack direction="row" gap={1} alignItems="center">
                        <TextField
                            size="small"
                            fullWidth
                            type="password"
                            autoComplete="new-password"
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
                                sx={{ flexShrink: 0 }}
                            >
                                {_('Remove token')}
                            </Button>
                        )}
                    </Stack>
                </FormLabel>
                <Alert severity="info">
                    {_(
                        'The token is stored encrypted on the server and is never shown again. Everyone with the story password pushes and pulls with it, so use a fine-grained token limited to this one repository (contents: read and write).'
                    )}
                </Alert>
                <LabeledTextField
                    label={_('Author name')}
                    placeholder={_("the story's author")}
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    slotProps={{
                        htmlInput: {
                            'aria-label': 'author name',
                            'maxLength': GIT_LIMITS.authorNameMaxLength,
                        },
                    }}
                />
                <LabeledTextField
                    label={_('Author email')}
                    placeholder="<story>@story.local"
                    helperText={_(
                        'Set from the story email when that changes.'
                    )}
                    value={authorEmail}
                    onChange={(e) => setAuthorEmail(e.target.value)}
                    slotProps={{
                        htmlInput: {
                            'aria-label': 'author email',
                            'maxLength': GIT_LIMITS.authorEmailMaxLength,
                        },
                    }}
                />
                {!config && (
                    <FormLabel label={_('First sync')}>
                        <RadioGroup
                            value={initial}
                            onChange={(e) =>
                                setInitial(setupMode(e.target.value))
                            }
                        >
                            <FormControlLabel
                                value="push"
                                control={<Radio />}
                                label={_('Upload this story to the repository')}
                            />
                            <FormControlLabel
                                value="pull"
                                control={<Radio />}
                                label={_(
                                    "Replace this story with the repository's content"
                                )}
                            />
                        </RadioGroup>
                    </FormLabel>
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
                    <Alert severity="error" sx={{ whiteSpace: 'pre-wrap' }}>
                        {error}
                    </Alert>
                )}
                <Stack direction="row" gap={1} justifyContent="flex-end">
                    {config && !disconnecting && (
                        <Button
                            color="error"
                            onClick={() => setDisconnecting(true)}
                            sx={{ mr: 'auto' }}
                        >
                            {_('Disconnect…')}
                        </Button>
                    )}
                    <Button
                        type="submit"
                        variant="outlined"
                        disabled={store.busy}
                    >
                        {config ? _('Save git settings') : _('Connect')}
                    </Button>
                </Stack>
            </Stack>
        </form>
    );
});
