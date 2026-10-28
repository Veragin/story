import { useState } from 'react';
import { Alert, Button } from '@mui/material';
import { observer } from 'mobx-react-lite';
import {
    GIT_DEFAULT_BRANCH,
    GIT_LIMITS,
    isGitBranchName,
    type TGitSetupMode,
} from '@story/protocol';
import { remoteUrlErrorMessage, showToast } from '@story/ui';
import { ErrorAlert } from '../components/feedback/ErrorAlert';
import { FormField } from '../components/form/FormField';
import { FormFields } from '../components/form/FormFields';
import { FormRadioInput } from '../components/form/FormRadioInput';
import { FormTextInput } from '../components/form/FormTextInput';
import { TextInput } from '../components/inputs/TextInput';
import { ActionRow } from '../components/layout/ActionRow';
import { InlineRow } from '../components/layout/InlineRow';
import { modals } from '../shell';
import { GitDisconnectPanel } from './GitDisconnectPanel';
import type { GitStore, TGitConfigPatch, TGitResult } from './GitStore';

type TProps = {
    store: GitStore;
};

const setupMode = (value: string | undefined): TGitSetupMode =>
    value === 'pull' ? 'pull' : 'push';

const setupModeOptions = () => [
    { id: 'push', label: _('Upload this story to the repository') },
    {
        id: 'pull',
        label: _("Replace this story with the repository's content"),
    },
];

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
            <FormFields>
                <FormTextInput
                    label={_('Remote URL')}
                    placeholder="https://github.com/me/story.git"
                    value={remoteUrl}
                    onChange={(next) => setRemoteUrl(next ?? '')}
                    error={touched ? urlError : null}
                    spellCheck={false}
                    maxLength={GIT_LIMITS.remoteUrlMaxLength}
                    dataField="remoteUrl"
                />
                <FormTextInput
                    label={_('Branch')}
                    value={branch}
                    onChange={(next) => setBranch(next ?? '')}
                    error={touched ? branchError : null}
                    spellCheck={false}
                    maxLength={GIT_LIMITS.branchMaxLength}
                    dataField="branch"
                />
                <FormField label={_('Access token')}>
                    <InlineRow>
                        <TextInput
                            type="password"
                            autoComplete="new-password"
                            placeholder={
                                config?.hasToken
                                    ? _('unchanged')
                                    : _('none: a public repository')
                            }
                            value={token}
                            onChange={setToken}
                            maxLength={GIT_LIMITS.tokenMaxLength}
                            ariaLabel={_('Access token')}
                            dataField="token"
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
                    </InlineRow>
                </FormField>
                <Alert severity="info">
                    {_(
                        'The token is stored encrypted on the server and is never shown again. Everyone with the story password pushes and pulls with it, so use a fine-grained token limited to this one repository (contents: read and write).'
                    )}
                </Alert>
                <FormTextInput
                    label={_('Author name')}
                    placeholder={_("the story's author")}
                    value={authorName}
                    onChange={(next) => setAuthorName(next ?? '')}
                    maxLength={GIT_LIMITS.authorNameMaxLength}
                    dataField="authorName"
                />
                <FormTextInput
                    label={_('Author email')}
                    placeholder="<story>@story.local"
                    helperText={_(
                        'Set from the story email when that changes.'
                    )}
                    value={authorEmail}
                    onChange={(next) => setAuthorEmail(next ?? '')}
                    maxLength={GIT_LIMITS.authorEmailMaxLength}
                    dataField="authorEmail"
                />
                {!config && (
                    <FormRadioInput
                        label={_('First sync')}
                        value={initial}
                        onChange={(next) => setInitial(setupMode(next))}
                        options={setupModeOptions()}
                        dataField="initial"
                    />
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
                <ErrorAlert error={error} />
                <ActionRow>
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
                </ActionRow>
            </FormFields>
        </form>
    );
});
