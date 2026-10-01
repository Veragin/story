import { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { reaction } from 'mobx';
import styled from '@emotion/styled';
import { Scene } from '../../canvas';
import { modals } from '../../shell';
import { Palette } from '../../MapEditor/components/Palette/Palette';
import { EditWidget } from '../../MapEditor/components/EditWidget';
import { LocationsLayer } from './LocationsLayer';
import type { MapPageStore } from './MapPageStore';

type Props = {
    store: MapPageStore;
    onOpenLocation: (locationId: string) => void;
};

export const MapCanvas = observer(({ store, onOpenLocation }: Props) => {
    const stageRef = useRef<HTMLDivElement>(null);
    const tilesRef = useRef<HTMLCanvasElement>(null);
    const sceneRef = useRef<HTMLCanvasElement>(null);
    const openRef = useRef(onOpenLocation);
    openRef.current = onOpenLocation;

    useEffect(() => {
        const stage = stageRef.current;
        const tilesCanvas = tilesRef.current;
        const sceneCanvas = sceneRef.current;
        if (!stage || !tilesCanvas || !sceneCanvas) return;

        const scene = new Scene(sceneCanvas, {
            camera: store.camera,
            editable: store.mode === 'locations',
        });
        const detachTiles = store.tiles.attach(tilesCanvas);
        const layer = new LocationsLayer(scene, store, (id) =>
            openRef.current(id)
        );

        const measure = () =>
            store.setViewport({
                width: stage.clientWidth,
                height: stage.clientHeight,
            });
        measure();
        const observer =
            typeof ResizeObserver !== 'undefined'
                ? new ResizeObserver(measure)
                : null;
        observer?.observe(stage);
        const offModal = reaction(
            () => modals.isOpen,
            (open) => (scene.keyboardPan = !open),
            { fireImmediately: true }
        );

        return () => {
            offModal();
            observer?.disconnect();
            layer.destroy();
            scene.destroy();
            detachTiles();
        };
    }, [store]);

    return (
        <SStage ref={stageRef}>
            <SCanvas ref={tilesRef} data-testid="map-tiles-canvas" />
            <SCanvas ref={sceneRef} data-testid="map-locations-canvas" />
            {store.mode === 'tiles' && (
                <>
                    <Palette mapStore={store.tiles} />
                    <EditWidget mapStore={store.tiles} />
                </>
            )}
        </SStage>
    );
});

const SStage = styled.div`
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    background-color: #000;
`;

const SCanvas = styled.canvas`
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
`;
