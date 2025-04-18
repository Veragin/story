import { Column, WholeContainer } from 'code/components/Basic';
import { useEffect, useState } from 'react';
import { MapStore } from './MapStore';
import { useVisualizerStore } from 'code/Context';
import { MapEditor } from './MapEditor';
import { ModalContent } from './components/ModalContent';
import { createDefaultMapData } from './createDefaultMapData';
import { TopBar } from './components/TopBar';
import { CircularProgress } from '@mui/material';
import { Header } from 'code/components/Text';
import styled from '@emotion/styled';
import { spacingCss } from 'code/components/css';

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

    const createNewMap = async (
        id: string,
        name: string,
        w: number,
        h: number
    ) => {
        const data = createDefaultMapData(id, name, w, h);
        await store.agent.saveMap(data);
        const newMapStore = new MapStore(store.canvasHandler, data);
        setMapStore(newMapStore);
    };

    return (
        <WholeContainer>
            <TopBar mapStore={mapStore} />

            {mapStore === undefined && <CircularProgress />}
            {mapStore && (
                <MapEditor mapStore={mapStore} createNewMap={createNewMap} />
            )}

            {mapStore === null && (
                <SColumn>
                    <Header>{_('Create map: %s', mapId)}</Header>
                    <ModalContent initId={mapId} onSubmit={createNewMap} />
                </SColumn>
            )}
        </WholeContainer>
    );
};

const SColumn = styled(Column)`
    gap: ${spacingCss(10)};
    width: 500px;
    margin: auto;
`;
