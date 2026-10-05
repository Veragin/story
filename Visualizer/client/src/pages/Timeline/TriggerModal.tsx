import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
} from '@mui/material';
import type { TMaybeCode } from '@story/visualizer-protocol';
import { ApiError } from '../../api';
import { FormStringInput } from '../../components/inputs/form/FormStringInput';
import { deepEqual } from '../../deepEqual';
import { errorMessage, type TimelineStore } from './store/TimelineStore';

type TTriggerProps = {
    store: TimelineStore;
    triggerId: string;
    close: () => void;
};

export const TriggerModal = observer(
    ({ store, triggerId, close }: TTriggerProps) => {
        const dto = store.triggers.get(triggerId);
        const [base, setBase] = useState(dto);
        const [name, setName] = useState<TMaybeCode<string>>(dto?.name ?? '');
        const [description, setDescription] = useState<TMaybeCode<string>>(
            dto?.description ?? ''
        );
        const [error, setError] = useState<string | null>(null);
        const [busy, setBusy] = useState(false);

        if (!dto || !base) {
            return (
                <Dialog open onClose={close} maxWidth="xs" fullWidth>
                    <DialogTitle>{_('Time trigger')}</DialogTitle>
                    <DialogContent>
                        <Alert severity="warning">
                            {_('Trigger %s no longer exists.', triggerId)}
                        </Alert>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={close}>{_('Close')}</Button>
                    </DialogActions>
                </Dialog>
            );
        }

        const nameChanged = !deepEqual(name, base.name);
        const descriptionChanged = !deepEqual(description, base.description);
        const dirty = nameChanged || descriptionChanged;
        const changedOnDisk = dto.version !== base.version;

        const reload = () => {
            setBase(dto);
            setName(dto.name);
            setDescription(dto.description);
            setError(null);
        };

        const save = async (version: string) => {
            setBusy(true);
            setError(null);
            try {
                await store.updateTrigger(triggerId, {
                    version,
                    ...(nameChanged ? { name } : {}),
                    ...(descriptionChanged ? { description } : {}),
                });
                close();
            } catch (e) {
                if (e instanceof ApiError && e.isStale) {
                    void store.refetchTrigger(triggerId);
                    setError(_('The trigger changed on disk.'));
                } else {
                    setError(errorMessage(e));
                }
                setBusy(false);
            }
        };

        return (
            <Dialog open onClose={close} maxWidth="sm" fullWidth>
                <DialogTitle>{_('Time trigger %s', triggerId)}</DialogTitle>
                <DialogContent>
                    <Stack gap={2} pt={1}>
                        <FormStringInput
                            label={_('Name')}
                            value={name}
                            onChange={(next) => setName(next ?? '')}
                            disabled={busy}
                            dataField="name"
                        />
                        <FormStringInput
                            label={_('Description')}
                            multiline
                            value={description}
                            onChange={(next) => setDescription(next ?? '')}
                            disabled={busy}
                            dataField="description"
                        />
                        {changedOnDisk && (
                            <Alert
                                severity="warning"
                                action={
                                    <Stack direction="row" gap={1}>
                                        <Button
                                            size="small"
                                            color="inherit"
                                            onClick={reload}
                                        >
                                            {_('Reload')}
                                        </Button>
                                        {dirty && (
                                            <Button
                                                size="small"
                                                color="inherit"
                                                disabled={busy}
                                                onClick={() =>
                                                    void save(dto.version)
                                                }
                                            >
                                                {_('Keep mine')}
                                            </Button>
                                        )}
                                    </Stack>
                                }
                            >
                                {_('Changed on disk')}
                            </Alert>
                        )}
                        {error && !changedOnDisk && (
                            <Alert severity="error">{error}</Alert>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button color="inherit" onClick={close}>
                        {_('Cancel')}
                    </Button>
                    <Button
                        variant="contained"
                        disabled={busy || !dirty || changedOnDisk}
                        onClick={() => void save(base.version)}
                    >
                        {_('Save')}
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }
);
