import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Alert } from '@mui/material';
import { FormAutocompleteInput } from '../../components/form/FormAutocompleteInput';
import { FormTextInput } from '../../components/form/FormTextInput';
import { AppDialog } from '../../components/dialog/AppDialog';
import { DialogButtons } from '../../components/dialog/DialogButtons';
import { useDialogSubmit } from '../../components/dialog/useDialogSubmit';
import type { ChapterGraphStore } from './ChapterGraphStore';
import { idError } from './dialogUtils';

type TProps = {
    store: ChapterGraphStore;
    onClose: () => void;
};

export const AddCharacterDialog = observer(({ store, onClose }: TProps) => {
    const options = store.availableCharacters;
    const [characterId, setCharacterId] = useState(options[0]?.id ?? '');
    const [startId, setStartId] = useState('intro');
    const startError = startId === '' ? null : idError(startId);
    const canSubmit = !!characterId && startError === null;

    const { busy, error, submit } = useDialogSubmit(
        async () => {
            await store.addCharacter(characterId, startId || undefined);
            onClose();
        },
        { canSubmit }
    );

    return (
        <AppDialog
            title={_('Add character to %s', store.chapterTitle)}
            size="xs"
            onClose={onClose}
            onSubmit={submit}
            error={error}
            actions={
                <DialogButtons
                    onClose={onClose}
                    label={_('Add')}
                    busyLabel={_('Adding…')}
                    busy={busy}
                    disabled={!canSubmit}
                    submit
                />
            }
        >
            {options.length === 0 ? (
                <Alert severity="info">
                    {_('Every character is already in this chapter.')}
                </Alert>
            ) : (
                <FormAutocompleteInput
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
            <FormTextInput
                label={_('Start passage id')}
                value={startId}
                error={startError}
                helperText={_('Local id of the start passage (default intro)')}
                onChange={(next) => setStartId((next ?? '').trim())}
                dataField="startId"
            />
        </AppDialog>
    );
});
