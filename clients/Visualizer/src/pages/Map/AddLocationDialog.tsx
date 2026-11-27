import { observer } from 'mobx-react-lite';
import { Button, styled } from '@mui/material';
import { spacingCss } from '@story/ui';
import { AppDialog } from '../../components/dialog/AppDialog';
import { DialogButtons } from '../../components/dialog/DialogButtons';
import { useDialogSubmit } from '../../components/dialog/useDialogSubmit';
import { HintText } from '../../components/feedback/HintText';
import { TitleIdInput } from '../../components/form/TitleIdInput';
import { useTitleId } from '../../components/form/useTitleId';
import type { MapPageStore } from './MapPageStore';

type TProps = {
    store: MapPageStore;
    onClose: () => void;
};

export const AddLocationDialog = observer(({ store, onClose }: TProps) => {
    const prefix = store.locationIdPrefix;
    const titleId = useTitleId('location', (localId) =>
        store.locations.has(prefix + localId)
    );
    const id = titleId.id && prefix + titleId.id;
    const name = titleId.title.trim();
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
            <TitleIdInput
                state={titleId}
                label={_('Name')}
                autoFocus
                idError={idError}
                idPrefix={prefix}
                idHelperText={_(
                    'Becomes data/locations/<id>.location.ts; cannot be renamed later.'
                )}
                titleDataField="name"
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
