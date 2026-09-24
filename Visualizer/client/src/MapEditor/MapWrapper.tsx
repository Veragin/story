import styled from '@emotion/styled';
import { Alert, Button, CircularProgress } from '@mui/material';
import { Column, spacingCss, WholeContainer } from '@story/ui';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { Nav, NavPicker } from '../components/Nav';
import { useVisualizerStore } from '../context';
import { MapEditor } from './MapEditor';
import { MapStore } from './MapStore';
import { MapToolbar } from './components/MapToolbar';

/**
 * Loads a map and its locations, then hands them to `MapStore`
 * (VISUALIZER_PLAN §7, Phase 6 gate: "reload restores from `data/`, not from a default grid").
 *
 * That gate is the point of this file. What it replaces began with:
 *
 *     // for dev
 *     const data = createDefaultMapData(mapId, 'Untitled', 100, 100);
 *     setMapStore(new MapStore(store.canvasHandler, data));
 *     return;                       // ← everything below was unreachable
 *
 * — an unconditional early return that made every reload start from a blank 100×100 grid and
 * left the `agent.getMap()` call beneath it dead (§1.1). The map is now read from the server,
 * which reads it from `data/maps/<id>.map.ts`, so what the author drew is what comes back.
 *
 * Two requests rather than one, because a location's polygon lives in the location's own file
 * (§4.2): the map supplies its notes, strokes and size; the locations supply the shapes.
 */
export const MapWrapper = observer(({ mapId }: { mapId: string }) => {
    const store = useVisualizerStore();
    const [mapStore, setMapStore] = useState<MapStore | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setMapStore(null);
        setError(null);

        void (async () => {
            try {
                const [map, locations] = await Promise.all([
                    store.agent.getMapById(mapId),
                    store.agent.getLocations(),
                ]);
                // The effect can resolve after the map id changed or the component unmounted;
                // without this the store for the *previous* map would replace the current one.
                if (cancelled) return;

                setMapStore(
                    new MapStore(store.agent, map, locations, (locationId) =>
                        store.setActiveTab({ tab: 'location', locationId })
                    )
                );
            } catch (caught) {
                if (cancelled) return;
                setError(
                    caught instanceof Error
                        ? caught.message
                        : _('Could not load the map')
                );
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [mapId, store]);

    return (
        <WholeContainer>
            <Nav>
                <NavPicker />
                {mapStore && <MapToolbar store={mapStore} />}
            </Nav>

            {error !== null && (
                <SMessage>
                    <Alert severity="error">{error}</Alert>
                    <Alert severity="info">
                        {_(
                            'The map is read from data/maps/ through the Visualizer server on :8123. Start it with `yarn dev:visualizer-server`.'
                        )}
                    </Alert>
                    <Button
                        variant="outlined"
                        onClick={() => store.setActiveTab(null)}
                    >
                        {_('Back to the timeline')}
                    </Button>
                </SMessage>
            )}

            {error === null && mapStore === null && (
                <SMessage>
                    <CircularProgress />
                </SMessage>
            )}

            {mapStore && <MapEditor store={mapStore} />}
        </WholeContainer>
    );
});

const SMessage = styled(Column)`
    gap: ${spacingCss(2)};
    width: 520px;
    margin: auto;
    align-items: center;
`;
