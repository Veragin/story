import { observer } from 'mobx-react-lite';
import { Alert } from '@mui/material';
import { AppDialog } from '../../components/dialog/AppDialog';
import { DialogButtons } from '../../components/dialog/DialogButtons';
import { LocationForm } from './LocationForm/LocationForm';
import type { MapPageStore } from './MapPageStore';

type TProps = {
    store: MapPageStore;
    locationId: string;
    readOnly: boolean;
    onClose: () => void;
};

export const LocationDialog = observer(
    ({ store, locationId, readOnly, onClose }: TProps) => {
        const location = store.locations.get(locationId);
        const title = _('Location %s', store.locationName(locationId));
        if (!location) {
            return (
                <AppDialog
                    title={title}
                    onClose={onClose}
                    actions={<DialogButtons closeOnly onClose={onClose} />}
                >
                    <Alert severity="warning">
                        {_(
                            'There is no location file for "%s". Only its shape is on the map; delete it or create the location on the Entities page.',
                            locationId
                        )}
                    </Alert>
                </AppDialog>
            );
        }
        return (
            <AppDialog title={title} onClose={onClose}>
                <LocationForm
                    location={location}
                    readOnly={readOnly}
                    onSave={(patch, version) =>
                        store.saveLocation(locationId, patch, version)
                    }
                    onSaved={onClose}
                    onCancel={onClose}
                />
            </AppDialog>
        );
    }
);
