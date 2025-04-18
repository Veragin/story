import { WholeContainer } from 'code/components/Basic';
import { useEffect, useState } from 'react';
import { MapStore } from './MapStore';
import { useVisualizerStore } from 'code/Context';
import { MapEditor } from './MapEditor';
import { ModalContent } from './components/ModalContent';
import { createDefaultMapData } from './createDefaultMapData';
import { TopBar } from './components/TopBar';
import { CircularProgress } from '@mui/material';

type Props = {
    mapId: string;
};

export const MapWrapper = ({ mapId }: Props) => {
    const store = useVisualizerStore();
    const [mapStore, setMapStore] = useState<MapStore | null | undefined>(
        undefined
    );

    useEffect(() => {
        (async () => {
            // for dev
            const data = createDefaultMapData(mapId, 'Untitled', 100, 100);
            setMapStore(new MapStore(store.canvasHandler, data));
            return;

            try {
                const data = await store.agent.getMap(mapId);
                setMapStore(new MapStore(store.canvasHandler, data));
            } catch {
                setMapStore(null);
            }
        })();
    }, [mapId]);

    return (
        <WholeContainer>
            <TopBar mapStore={mapStore} />

            {mapStore === undefined && <CircularProgress />}
            {mapStore && (
                <MapEditor
                    mapStore={mapStore}
                    openMap={(mapId) =>
                        store.setActiveTab({ mapId, tab: 'map' })
                    }
                />
            )}

            {mapStore === null && (
                <ModalContent
                    initId={mapId}
                    onSubmit={(
                        id: string,
                        name: string,
                        w: number,
                        h: number
                    ) => {
                        const data = createDefaultMapData(id, name, w, h);
                        const newMapStore = new MapStore(
                            store.canvasHandler,
                            data
                        );
                        setMapStore(newMapStore);
                    }}
                />
            )}
        </WholeContainer>
    );
};
