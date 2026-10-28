import { useState } from 'react';
import { Alert, styled, Typography } from '@mui/material';
import { observer } from 'mobx-react-lite';
import {
    GIT_CHANGE_KINDS,
    GIT_LIMITS,
    type TApiErrorBody,
    type TGitChangeKind,
} from '@story/protocol';
import { showToast } from '@story/ui';
import { errorBodyMessage } from '../api';
import { AppDialog } from '../components/dialog/AppDialog';
import { DialogButtons } from '../components/dialog/DialogButtons';
import { FormCheckbox } from '../components/form/FormCheckbox';
import { FormSection } from '../components/form/FormSection';
import { FormTextInput } from '../components/form/FormTextInput';
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

        const actions = !committed ? (
            <DialogButtons
                submit
                onClose={close}
                label={push ? _('Commit & push') : _('Commit')}
                disabled={store.busy || !trimmed || changes.length === 0}
            />
        ) : pushError.error === 'git_rejected' ? (
            <DialogButtons
                onClose={close}
                cancelLabel={_('Close')}
                onConfirm={() => void pullThenPush()}
                label={_('Pull then push')}
                disabled={store.busy}
            />
        ) : (
            <DialogButtons closeOnly onClose={close} />
        );

        return (
            <AppDialog
                title={_('Commit & push')}
                onClose={close}
                onSubmit={commit}
                error={error}
                actions={actions}
            >
                {committed ? (
                    <SAlert severity="warning">
                        {_(
                            'Committed locally, but the push failed: %s',
                            errorBodyMessage(pushError)
                        )}
                    </SAlert>
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
                                    <FormSection
                                        title={`${KIND_LABELS[kind]()} (${files.length})`}
                                    >
                                        <div>
                                            {files.map((c) => (
                                                <SPath
                                                    key={c.path}
                                                    variant="body2"
                                                >
                                                    {c.path}
                                                </SPath>
                                            ))}
                                        </div>
                                    </FormSection>
                                </div>
                            );
                        })}
                        <FormTextInput
                            autoFocus
                            multiline
                            label={_('Message')}
                            value={message}
                            onChange={(next) => setMessage(next ?? '')}
                            maxLength={GIT_LIMITS.messageMaxLength}
                            dataField="message"
                        />
                        <FormCheckbox
                            label={_('Push after commit')}
                            value={push}
                            onChange={(next) => setPush(next ?? false)}
                            dataField="push"
                        />
                    </>
                )}
            </AppDialog>
        );
    }
);

const SAlert = styled(Alert)`
    white-space: pre-wrap;
`;

const SPath = styled(Typography)`
    font-family: monospace;
`;
