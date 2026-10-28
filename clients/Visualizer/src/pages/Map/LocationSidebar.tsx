import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { Alert, Button } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { TooltipIconButton } from '../../components/buttons/TooltipIconButton';
import { Panel } from '../../components/layout/Panel';
import { PanelSection } from '../../components/layout/PanelSection';
import { LocationDetails } from './LocationDetails';
import type { MapPageStore } from './MapPageStore';

type TProps = {
    store: MapPageStore;
    locationId: string;
    onOpenMap: (id: string) => void;
    onAddMap: (id: string) => void;
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
};

export const LocationSidebar = observer(
    ({ store, locationId, onOpenMap, onAddMap, onEdit, onDelete }: TProps) => {
        const location = store.locations.get(locationId);
        const mapVersion = store.locationMaps.get(locationId);

        useEffect(() => {
            void store.fetchLocationMap(locationId).catch(() => undefined);
        }, [store, locationId]);

        return (
            <Panel
                variant="sidebar"
                title={store.locationName(locationId)}
                data-testid="location-sidebar"
                actions={
                    <TooltipIconButton
                        title={_('Close')}
                        icon={CloseIcon}
                        tone="inherit"
                        onClick={() => store.selectLocation(null)}
                    />
                }
                footer={
                    <>
                        {mapVersion === null ? (
                            <Button
                                variant="contained"
                                onClick={() => onAddMap(locationId)}
                            >
                                {_('Add map')}
                            </Button>
                        ) : (
                            <Button
                                variant="contained"
                                disabled={mapVersion === undefined}
                                onClick={() => onOpenMap(locationId)}
                            >
                                {_('Open')}
                            </Button>
                        )}
                        <Button
                            variant="outlined"
                            disabled={!location}
                            onClick={() => onEdit(locationId)}
                        >
                            {_('Edit')}
                        </Button>
                        <Button
                            variant="outlined"
                            color="error"
                            onClick={() => onDelete(locationId)}
                        >
                            {_('Delete')}
                        </Button>
                    </>
                }
            >
                <PanelSection>
                    {location ? (
                        <LocationDetails
                            location={location}
                            sublocationNames={store
                                .childLocationIds(locationId)
                                .map(store.locationName)}
                        />
                    ) : (
                        <Alert severity="warning">
                            {_(
                                'There is no location file for "%s". Only its shape is on the map.',
                                locationId
                            )}
                        </Alert>
                    )}
                </PanelSection>
            </Panel>
        );
    }
);
