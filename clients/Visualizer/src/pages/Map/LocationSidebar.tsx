import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { Alert } from '@mui/material';
import { Sidebar } from '../../components/layout/Sidebar';
import { SidebarHeading } from '../../components/layout/SidebarHeading';
import { SidebarMeta } from '../../components/layout/SidebarMeta';
import { SidebarOverlay } from '../../components/layout/SidebarOverlay';
import { LocationEditor } from './LocationEditor/LocationEditor';
import { LocationToolbar } from './LocationEditor/LocationToolbar';
import type { MapPageStore } from './MapPageStore';

type TProps = {
    store: MapPageStore;
    locationId: string;
    onAddMap: (id: string) => void;
    onDelete: (id: string) => void;
};

export const LocationSidebar = observer(
    ({ store, locationId, onAddMap, onDelete }: TProps) => {
        const location = store.locations.get(locationId);

        useEffect(() => {
            void store.fetchLocationMap(locationId).catch(() => undefined);
        }, [store, locationId]);

        return (
            <SidebarOverlay>
                <Sidebar
                    label={store.locationName(locationId)}
                    data-testid="location-sidebar"
                >
                    {location ? (
                        <LocationEditor
                            key={locationId}
                            store={store}
                            location={location}
                            onAddMap={onAddMap}
                            onDelete={onDelete}
                        />
                    ) : (
                        <>
                            <LocationToolbar
                                store={store}
                                locationId={locationId}
                                onAddMap={onAddMap}
                                onDelete={onDelete}
                            />
                            <SidebarHeading
                                title={store.locationName(locationId)}
                                badge={_('location')}
                            />
                            <SidebarMeta values={[locationId]} />
                            <Alert severity="warning">
                                {_(
                                    'There is no location file for "%s". Only its shape is on the map.',
                                    locationId
                                )}
                            </Alert>
                        </>
                    )}
                </Sidebar>
            </SidebarOverlay>
        );
    }
);
