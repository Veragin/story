import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { Button, styled } from '@mui/material';
import { spacingCss } from '@story/ui';
import { AppDialog } from '../../components/dialog/AppDialog';
import { DialogButtons } from '../../components/dialog/DialogButtons';
import { useDialogSubmit } from '../../components/dialog/useDialogSubmit';
import { HintText } from '../../components/feedback/HintText';
import { FormTextInput } from '../../components/form/FormTextInput';
import type { MapPageStore } from './MapPageStore';
import { locationIdFromName } from './locationTree';

type TProps = {
    store: MapPageStore;
    onClose: () => void;
};

export const AddLocationDialog = observer(({ store, onClose }: TProps) => {
    const [name, setName] = useState('');
    const [customId, setCustomId] = useState<string | null>(null);
    const localId = customId ?? locationIdFromName(name);
    const prefix = store.locationIdPrefix;
    const id = localId && prefix + localId;
    const idError = id ? store.validateLocationId(id) : null;
    const unplaced = store.unplacedLocations;

    const { busy, error, submit } = useDialogSubmit(
        async () => {
            await store.addLocation({ id, name: name || id });
            onClose();
        },
        { canSubmit: id !== '' && idError === null }
    );

    return (
        <AppDialog
            title={_('Add location')}
            onClose={onClose}
            onSubmit={submit}
            error={error}
            actions={
                <DialogButtons
                    onClose={onClose}
                    label={_('Create')}
                    busyLabel={_('Creating…')}
                    busy={busy}
                    disabled={!id || idError !== null}
                    submit
                />
            }
        >
            <FormTextInput
                label={_('Name')}
                value={name}
                onChange={(next = '') => setName(next)}
                autoFocus
                dataField="name"
            />
            <FormTextInput
                label={_('Id')}
                value={localId}
                onChange={(next = '') => setCustomId(next.trim() || null)}
                error={idError}
                helperText={_(
                    'Becomes data/locations/<id>.location.ts; cannot be renamed later.'
                )}
                startAdornment={prefix || undefined}
                dataField="id"
            />
            {unplaced.length > 0 && (
                <SPlace>
                    <HintText size="small">
                        {_(
                            'Or place an existing location that has no shape yet:'
                        )}
                    </HintText>
                    <SChoices>
                        {unplaced.map((l) => (
                            <Button
                                key={l.id}
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                    store.placeLocation(l.id);
                                    onClose();
                                }}
                            >
                                {store.locationName(l.id)}
                            </Button>
                        ))}
                    </SChoices>
                </SPlace>
            )}
        </AppDialog>
    );
});

const SPlace = styled('div')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(1)};
`;

const SChoices = styled('div')`
    display: flex;
    flex-wrap: wrap;
    gap: ${spacingCss(1)};
`;
