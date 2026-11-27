import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Alert } from '@mui/material';
import type { TMaybeCode } from '@story/protocol';
import { ApiError } from '../../api';
import { FormMaybeCodeTextInput } from '../../components/code/FormMaybeCodeTextInput';
import { AppDialog } from '../../components/dialog/AppDialog';
import { DialogButtons } from '../../components/dialog/DialogButtons';
import { useDialogSubmit } from '../../components/dialog/useDialogSubmit';
import { ConflictAlert } from '../../components/feedback/ConflictAlert';
import { deepEqual } from '../../deepEqual';
import type { TimelineStore } from './store/TimelineStore';

type TProps = {
    store: TimelineStore;
    triggerId: string;
    onClose: () => void;
};

export const TriggerDialog = observer(
    ({ store, triggerId, onClose }: TProps) => {
        const dto = store.triggers.get(triggerId);
        const [base, setBase] = useState(dto);
        const [name, setName] = useState<TMaybeCode<string>>(dto?.name ?? '');
        const [description, setDescription] = useState<TMaybeCode<string>>(
            dto?.description ?? ''
        );
        const nameChanged = !deepEqual(name, base?.name);
        const descriptionChanged = !deepEqual(description, base?.description);
        const dirty = nameChanged || descriptionChanged;

        // equals base.version unless saving via Keep mine
        const { busy, error, submit, setError } = useDialogSubmit(async () => {
            if (!dto) return;
            try {
                await store.updateTrigger(triggerId, {
                    version: dto.version,
                    ...(nameChanged ? { name } : {}),
                    ...(descriptionChanged ? { description } : {}),
                });
                onClose();
            } catch (e) {
                if (e instanceof ApiError && e.isStale) {
                    void store.refetchTrigger(triggerId);
                    throw new Error(_('The trigger changed on disk.'));
                }
                throw e;
            }
        });

        if (!dto || !base) {
            return (
                <AppDialog
                    title={_('Time trigger')}
                    size="xs"
                    onClose={onClose}
                    actions={<DialogButtons closeOnly onClose={onClose} />}
                >
                    <Alert severity="warning">
                        {_('Trigger %s no longer exists.', triggerId)}
                    </Alert>
                </AppDialog>
            );
        }

        const changedOnDisk = dto.version !== base.version;

        const reload = () => {
            setBase(dto);
            setName(dto.name);
            setDescription(dto.description);
            setError(null);
        };

        return (
            <AppDialog
                title={_('Time trigger %s', triggerId)}
                onClose={onClose}
                onSubmit={submit}
                error={changedOnDisk ? null : error}
                actions={
                    <DialogButtons
                        onClose={onClose}
                        label={_('Save')}
                        busyLabel={_('Saving…')}
                        busy={busy}
                        disabled={!dirty || changedOnDisk}
                        submit
                    />
                }
            >
                <FormMaybeCodeTextInput
                    label={_('Name')}
                    value={name}
                    onChange={(next) => setName(next ?? '')}
                    disabled={busy}
                    dataField="name"
                />
                <FormMaybeCodeTextInput
                    label={_('Description')}
                    multiline
                    value={description}
                    onChange={(next) => setDescription(next ?? '')}
                    disabled={busy}
                    dataField="description"
                />
                {changedOnDisk && (
                    <ConflictAlert
                        what={_('trigger')}
                        onReload={reload}
                        onKeepMine={dirty ? submit : undefined}
                        disabled={busy}
                    />
                )}
            </AppDialog>
        );
    }
);
