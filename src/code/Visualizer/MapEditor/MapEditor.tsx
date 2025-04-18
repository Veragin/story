import { Row } from 'code/components/Basic';
import styled from '@emotion/styled';
import { MapStore } from './MapStore';
import { useEffect, useRef } from 'react';

type Props = {
    mapStore: MapStore;
    createNewMap: () => void;
};

export const MapEditor = ({ mapStore }: Props) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const infoRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (canvasRef.current && infoRef.current) {
            mapStore.init(canvasRef.current, infoRef.current);
        }

        return () => {
            mapStore.deinit();
        };
    }, []);

    return (
        <>
            <SCanvas ref={canvasRef} />
            <SRow ref={infoRef} />
        </>
    );
};

const SCanvas = styled.canvas`
    width: 100%;
    height: 100%;
    background-color: #000;
    overflow: hidden;
`;

const SRow = styled(Row)`
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 30px;
    background-color: grey;
    z-index: 100;
    padding: 4px;
`;
