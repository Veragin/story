import { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { Alert, Button, styled } from '@mui/material';
import { spacingCss } from '@story/ui';
import { router, useKey } from '../../shell';
import { LoadErrorState } from '../../components/feedback/LoadErrorState';
import { LoadingState } from '../../components/feedback/LoadingState';
import { ReferenceList } from '../../components/feedback/ReferenceList';
import { ActionRow } from '../../components/layout/ActionRow';
import { TileTools } from '../../MapEditor/components/TileTools';
import type { MapPageStore } from './MapPageStore';
import { MapControlBar } from './MapControlBar';
import { MapCanvas } from './MapCanvas';
import { LocationTools } from './LocationTools';
import {
    openAddLocation,
    openLocation as openLocationDialog,
} from './mapDialogs';
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

    const openLocation = (id: string) => track(openLocationDialog(store, id));
    const editLocation = (id: string) =>
        track(openLocationDialog(store, id, { readOnly: false }));
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
            {store.notice && (
                <SNotice
                    severity={store.notice.kind}
                    onClose={() => store.setNotice(null)}
                >
                    {store.notice.text}
                    {store.notice.references &&
                        store.notice.references.length > 0 && (
                            <ReferenceList
                                references={store.notice.references}
                            />
                        )}
                </SNotice>
            )}
            {store.loadState === 'loading' && (
                <SCenter>
                    <LoadingState />
                </SCenter>
            )}
            {store.loadState === 'error' && (
                <SCenter>
                    <LoadErrorState
                        message={_(
                            'Could not load the map: %s',
                            store.loadError ?? ''
                        )}
                        onRetry={() => void store.load()}
                    />
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
                    <ActionRow>
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
                    </ActionRow>
                </SCenter>
            )}
            {store.loadState === 'ready' && (
                <SMapArea>
                    <MapCanvas store={store} onOpenLocation={onCanvasAction} />
                    <MapBreadcrumbs store={store} />
                    {store.mode === 'locations' && (
                        <LocationTools
                            store={store}
                            onAdd={() => track(openAddLocation(store))}
                            onOpen={openLocation}
                            onEdit={editLocation}
                            onDelete={deleteLocation}
                        />
                    )}
                    {store.mode === 'tiles' && (
                        <TileTools mapStore={store.tiles} />
                    )}
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

const SMapArea = styled('div')`
    position: relative;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
`;

const SCenter = styled('div')`
    display: flex;
    flex-direction: column;
    margin: auto;
    gap: ${spacingCss(2)};
    align-items: center;
`;

const SNotice = styled(Alert)`
    position: absolute;
    top: 56px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 5;
    max-width: 480px;
`;
