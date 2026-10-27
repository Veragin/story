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
import { LabeledTextField } from '@story/ui';
import { FormTypeInput } from '../../components/inputs/form/FormTypeInput';
import type { ChapterGraphStore } from './ChapterGraphStore';
import { errorText, idError } from './dialogUtils';

export const AddCharacterDialog = observer(
    ({ store, onClose }: { store: ChapterGraphStore; onClose: () => void }) => {
        const options = store.availableCharacters;
        const [characterId, setCharacterId] = useState(options[0]?.id ?? '');
        const [startId, setStartId] = useState('intro');
        const [busy, setBusy] = useState(false);
        const [error, setError] = useState<string | null>(null);
        const startError = startId === '' ? null : idError(startId);

        const submit = async () => {
            setBusy(true);
            setError(null);
            try {
                await store.addCharacter(characterId, startId || undefined);
                onClose();
            } catch (e) {
                setError(errorText(e));
                setBusy(false);
            }
        };

        return (
            <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
                <DialogTitle>
                    {_('Add character to %s', store.chapterTitle)}
                </DialogTitle>
                <DialogContent>
                    <Stack gap={2} sx={{ pt: 1 }}>
                        {options.length === 0 ? (
                            <Alert severity="info">
                                {_(
                                    'Every character is already in this chapter.'
                                )}
                            </Alert>
                        ) : (
                            <FormTypeInput
                                label={_('Character')}
                                value={characterId}
                                onChange={(next) => setCharacterId(next ?? '')}
                                options={options.map((c) => ({
                                    id: c.id,
                                    label: `${c.name} (${c.id})`,
                                }))}
                                dataField="characterId"
                            />
                        )}
                        <LabeledTextField
                            label={_('Start passage id')}
                            value={startId}
                            error={startError}
                            helperText={_(
                                'Local id of the start passage (default intro)'
                            )}
                            onChange={(e) => setStartId(e.target.value.trim())}
                        />
                        {error && <Alert severity="error">{error}</Alert>}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button color="inherit" onClick={onClose}>
                        {_('Cancel')}
                    </Button>
                    <Button
                        variant="contained"
                        disabled={busy || !characterId || startError !== null}
                        onClick={() => void submit()}
                    >
                        {_('Add')}
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }
);
