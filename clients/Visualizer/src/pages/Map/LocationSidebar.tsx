import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import styled from '@emotion/styled';
import { Alert, Button, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { Column, LargeText, Row, spacingCss } from '@story/ui';
import { LocationDetails } from './LocationDetails';
import type { MapPageStore } from './MapPageStore';

type Props = {
    store: MapPageStore;
    locationId: string;
    onOpenMap: (id: string) => void;
    onAddMap: (id: string) => void;
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
};

export const LocationSidebar = observer(
    ({ store, locationId, onOpenMap, onAddMap, onEdit, onDelete }: Props) => {
        const location = store.locations.get(locationId);
        const mapVersion = store.locationMaps.get(locationId);

        useEffect(() => {
            void store.fetchLocationMap(locationId).catch(() => undefined);
        }, [store, locationId]);

        return (
            <SPanel data-testid="location-sidebar">
                <SHeader>
                    <LargeText>{store.locationName(locationId)}</LargeText>
                    <IconButton
                        size="small"
                        color="inherit"
                        onClick={() => store.selectLocation(null)}
                        aria-label={_('Close')}
                    >
                        <CloseIcon />
                    </IconButton>
                </SHeader>
                <SBody>
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
                </SBody>
                <SButtons>
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
                </SButtons>
            </SPanel>
        );
    }
);

const SPanel = styled(Column)`
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 4;
    width: min(340px, 90vw);
    background-color: #111;
    border-left: 1px solid #686868;
    color: #fff;
`;

const SHeader = styled(Row)`
    flex-shrink: 0;
    justify-content: space-between;
    align-items: center;
    padding: ${spacingCss(1.5)} ${spacingCss(2)};
    background-color: #2a2a2a;
`;

const SBody = styled.div`
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: ${spacingCss(2)};
`;

const SButtons = styled(Row)`
    flex-shrink: 0;
    flex-wrap: wrap;
    gap: ${spacingCss(1)};
    padding: ${spacingCss(2)};
    border-top: 1px solid #333;
`;
