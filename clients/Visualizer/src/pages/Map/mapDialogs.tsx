import { modals } from '../../shell';
import { AddLocationDialog } from './AddLocationDialog';
import { DeleteLocationDialog } from './DeleteLocationDialog';
import { LocationDialog } from './LocationDialog';
import { MapHelpDialog } from './MapHelpDialog';
import { MapSizeDialog } from './MapSizeDialog';
import type {
    MapPageStore,
    TDeleteLocationChoice,
    TDeleteLocationRequest,
    TMapSize,
} from './MapPageStore';

export const askMapSize = (locationName: string) =>
    modals.ask<TMapSize | null>(
        (answer) => (
            <MapSizeDialog
                locationName={locationName}
                onConfirm={answer}
                onClose={() => answer(null)}
            />
        ),
        null
    );

export const askDeleteLocation = (request: TDeleteLocationRequest) =>
    modals.ask<TDeleteLocationChoice | null>(
        (answer) => (
            <DeleteLocationDialog
                request={request}
                onDelete={answer}
                onClose={() => answer(null)}
            />
        ),
        null
    );

export const openAddLocation = (store: MapPageStore) =>
    modals.open((close) => <AddLocationDialog store={store} onClose={close} />);

export const openLocation = (
    store: MapPageStore,
    locationId: string,
    { readOnly = store.mode === 'view' }: { readOnly?: boolean } = {}
) =>
    modals.open((close) => (
        <LocationDialog
            store={store}
            locationId={locationId}
            readOnly={readOnly}
            onClose={close}
        />
    ));

export const openMapHelp = () =>
    modals.open((close) => <MapHelpDialog onClose={close} />);
