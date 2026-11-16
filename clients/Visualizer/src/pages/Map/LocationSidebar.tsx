import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { Alert, styled } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import MapIcon from '@mui/icons-material/Map';
import { TooltipIconButton } from '../../components/buttons/TooltipIconButton';
import { Sidebar } from '../../components/layout/Sidebar';
import { SidebarHeading } from '../../components/layout/SidebarHeading';
import { SidebarMeta } from '../../components/layout/SidebarMeta';
import { SidebarToolbar } from '../../components/layout/SidebarToolbar';
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
            <SContainer>
                <Sidebar
                    label={store.locationName(locationId)}
                    data-testid="location-sidebar"
                >
                    <SidebarToolbar
                        start={
                            <>
                                <TooltipIconButton
                                    title={_('Delete location')}
                                    icon={DeleteIcon}
                                    tone="error"
                                    onClick={() => onDelete(locationId)}
                                    data-action="delete"
                                />
                                <TooltipIconButton
                                    title={_('Edit location')}
                                    icon={EditIcon}
                                    tone="inherit"
                                    disabled={!location}
                                    onClick={() => onEdit(locationId)}
                                    data-action="edit"
                                />
                            </>
                        }
                        end={
                            <>
                                {mapVersion === null ? (
                                    <TooltipIconButton
                                        title={_('Add map')}
                                        icon={AddIcon}
                                        tone="inherit"
                                        onClick={() => onAddMap(locationId)}
                                        data-action="add-map"
                                    />
                                ) : (
                                    <TooltipIconButton
                                        title={_('Open map')}
                                        icon={MapIcon}
                                        tone="inherit"
                                        disabled={mapVersion === undefined}
                                        onClick={() => onOpenMap(locationId)}
                                        data-action="open-map"
                                    />
                                )}
                                <TooltipIconButton
                                    title={_('Close')}
                                    icon={CloseIcon}
                                    tone="inherit"
                                    onClick={() => store.selectLocation(null)}
                                    data-action="close"
                                />
                            </>
                        }
                    />
                    <SidebarHeading
                        title={store.locationName(locationId)}
                        badge={_('location')}
                    />
                    <SidebarMeta values={[locationId, location?.file]} />
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
                </Sidebar>
            </SContainer>
        );
    }
);

const SContainer = styled('div')(({ theme }) => ({
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    zIndex: 4,
    width: 'min(340px, 90vw)',
    overflowY: 'auto',
    scrollbarWidth: 'thin',
    color: theme.palette.text.primary,
    fontSize: theme.typography.small.fontSize,
    backgroundColor: theme.palette.surface.overlay,
    borderLeft: `1px solid ${theme.palette.border.strong}`,
}));
