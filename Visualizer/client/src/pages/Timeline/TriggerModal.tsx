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
    TextField,
} from '@mui/material';
import { isCode, type TTriggerDto } from '@story/visualizer-protocol';
import { ApiError } from '../../api';
import { errorMessage, type TimelineStore } from './store/TimelineStore';

const asText = (value: TTriggerDto['name']) =>
    isCode(value) ? value.code : value;

type TTriggerProps = {
    store: TimelineStore;
    triggerId: string;
    close: () => void;
};

export const TriggerModal = observer(
    ({ store, triggerId, close }: TTriggerProps) => {
        const dto = store.triggers.get(triggerId);
        const [base, setBase] = useState(dto);
        const [name, setName] = useState(dto ? asText(dto.name) : '');
        const [description, setDescription] = useState(
            dto ? asText(dto.description) : ''
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

        const nameIsCode = isCode(base.name);
        const descriptionIsCode = isCode(base.description);
        const dirty =
            name !== asText(base.name) ||
            description !== asText(base.description);
        const changedOnDisk = dto.version !== base.version;

        const reload = () => {
            setBase(dto);
            setName(asText(dto.name));
            setDescription(asText(dto.description));
            setError(null);
        };

        const save = async (version: string) => {
            setBusy(true);
            setError(null);
            try {
                await store.updateTrigger(triggerId, {
                    version,
                    ...(nameIsCode ? {} : { name }),
                    ...(descriptionIsCode ? {} : { description }),
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
                        <TextField
                            size="small"
                            label={_('Name')}
                            value={name}
                            disabled={nameIsCode}
                            helperText={
                                nameIsCode
                                    ? _(
                                          'Code in the source; edit it in the editor'
                                      )
                                    : undefined
                            }
                            onChange={(e) => setName(e.target.value)}
                        />
                        <TextField
                            size="small"
                            label={_('Description')}
                            value={description}
                            disabled={descriptionIsCode}
                            helperText={
                                descriptionIsCode
                                    ? _(
                                          'Code in the source; edit it in the editor'
                                      )
                                    : undefined
                            }
                            multiline
                            minRows={3}
                            onChange={(e) => setDescription(e.target.value)}
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
