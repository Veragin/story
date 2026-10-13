import { observer } from 'mobx-react-lite';
import { Alert } from '@mui/material';
import { Modal } from '@story/ui';
import { modals } from '../../shell';
import { LocationForm } from './LocationForm/LocationForm';
import type { MapPageStore } from './MapPageStore';

export const openLocationModal = (store: MapPageStore, locationId: string) =>
    modals.open((close) => (
        <LocationModal store={store} locationId={locationId} onClose={close} />
    ));

const LocationModal = observer(
    ({
        store,
        locationId,
        onClose,
    }: {
        store: MapPageStore;
        locationId: string;
        onClose: () => void;
    }) => {
        const location = store.locations.get(locationId);
        const readOnly = store.mode === 'view';
        return (
            <Modal
                open
                title={_('Location %s', store.locationName(locationId))}
                onClose={onClose}
            >
                {location ? (
                    <LocationForm
                        location={location}
                        readOnly={readOnly}
                        onSave={(patch, version) =>
                            store.saveLocation(locationId, patch, version)
                        }
                        onSaved={onClose}
                        onCancel={onClose}
                    />
                ) : (
                    <Alert severity="warning">
                        {_(
                            'There is no location file for "%s". Only its shape is on the map; delete it or create the location on the Entities page.',
                            locationId
                        )}
                    </Alert>
                )}
            </Modal>
        );
    }
);
