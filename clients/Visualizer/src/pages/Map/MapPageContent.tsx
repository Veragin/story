import { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import styled from '@emotion/styled';
import { Alert, Button, CircularProgress } from '@mui/material';
import { Column, Row, spacingCss } from '@story/ui';
import { router, useKey } from '../../shell';
import { TileToolbar } from '../../MapEditor/components/TileToolbar';
import type { MapPageStore } from './MapPageStore';
import { MapControlBar } from './MapControlBar';
import { MapCanvas } from './MapCanvas';
import { LocationToolbar, SToolRow } from './LocationToolbar';
import { openLocationModal } from './LocationModal';
import { openAddLocationModal } from './AddLocationModal';
import { LocationSidebar } from './LocationSidebar';
import { MapBreadcrumbs } from './MapBreadcrumbs';
import { addLocationMap, openLocationMap } from './openLocationMap';
import { mapRoute } from './mapRoute';

export const MapPageContent = observer(({ store }: { store: MapPageStore }) => {
    const closers = useRef(new Set<() => void>());
    const track = (close: () => void) => {
        closers.current.add(close);
    };
    useEffect(() => {
        const set = closers.current;
        return () => set.forEach((close) => close());
    }, []);

    const openLocation = (id: string) => track(openLocationModal(store, id));
    const editLocation = (id: string) =>
        track(openLocationModal(store, id, { readOnly: false }));
    const deleteLocation = (id: string) => void store.deleteLocation(id);
    const openMap = (id: string) => void openLocationMap(store, id);
    const addMap = (id: string) => void addLocationMap(store, id);
    const onCanvasAction = (id: string) =>
        store.mode === 'view' ? openMap(id) : openLocation(id);
    const addThisMap = async () => {
        if (await addLocationMap(store, store.mapId)) await store.load();
    };

    useKey(
        ['Delete', 'Backspace'],
        () => {
            if (store.selectedLocationId)
                deleteLocation(store.selectedLocationId);
            return true;
        },
        {
            enabled:
                store.mode === 'locations' && store.selectedLocationId !== null,
        }
    );

    return (
        <>
            <MapControlBar store={store} />
            {store.mode === 'locations' && (
                <SToolRow data-testid="map-tooling-row">
                    <LocationToolbar
                        store={store}
                        onAdd={() => track(openAddLocationModal(store))}
                        onOpen={openLocation}
                        onDelete={deleteLocation}
                    />
                </SToolRow>
            )}
            {store.mode === 'tiles' && (
                <SToolRow data-testid="map-tooling-row">
                    <TileToolbar mapStore={store.tiles} />
                </SToolRow>
            )}
            {store.notice && (
                <SNotice
                    severity={store.notice.kind}
                    onClose={() => store.setNotice(null)}
                >
                    {store.notice.text}
                    {store.notice.references &&
                        store.notice.references.length > 0 && (
                            <ul>
                                {store.notice.references.map((r, i) => (
                                    <li key={i}>
                                        {r.file}:{r.line}
                                        {r.text ? ` — ${r.text}` : ''}
                                    </li>
                                ))}
                            </ul>
                        )}
                </SNotice>
            )}
            {store.loadState === 'loading' && (
                <SCenter>
                    <CircularProgress />
                </SCenter>
            )}
            {store.loadState === 'error' && (
                <SCenter>
                    <Alert severity="error">
                        {_('Could not load the map: %s', store.loadError ?? '')}
                    </Alert>
                    <Button
                        variant="contained"
                        onClick={() => void store.load()}
                    >
                        {_('Retry')}
                    </Button>
                </SCenter>
            )}
            {store.loadState === 'missing' && (
                <SCenter>
                    <Alert severity="info">
                        {_(
                            '%s has no map yet.',
                            store.locationName(store.mapId)
                        )}
                    </Alert>
                    <Row style={{ gap: 8 }}>
                        <Button
                            variant="contained"
                            onClick={() => void addThisMap()}
                        >
                            {_('Add map')}
                        </Button>
                        <Button
                            color="inherit"
                            href={router.href(mapRoute(store.parentMapId))}
                        >
                            {_('Back')}
                        </Button>
                    </Row>
                </SCenter>
            )}
            {store.loadState === 'ready' && (
                <SMapArea>
                    <MapCanvas store={store} onOpenLocation={onCanvasAction} />
                    <MapBreadcrumbs store={store} />
                    {store.mode === 'view' && store.selectedLocationId && (
                        <LocationSidebar
                            store={store}
                            locationId={store.selectedLocationId}
                            onOpenMap={openMap}
                            onAddMap={addMap}
                            onEdit={editLocation}
                            onDelete={deleteLocation}
                        />
                    )}
                </SMapArea>
            )}
        </>
    );
});

const SMapArea = styled(Column)`
    position: relative;
    flex: 1;
    min-height: 0;
`;

const SCenter = styled(Column)`
    margin: auto;
    gap: ${spacingCss(2)};
    align-items: center;
`;

const SNotice = styled(Alert)`
    position: absolute;
    top: 56px;
    right: ${spacingCss(2)};
    z-index: 5;
    max-width: 480px;
    & ul {
        margin: ${spacingCss(0.5)} 0 0;
        padding-left: ${spacingCss(2)};
    }
`;
