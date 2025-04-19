import { Row } from 'code/components/Basic';
import styled from '@emotion/styled';
import { MapStore } from './MapStore';
import { useEffect, useRef } from 'react';
import { Modal } from 'code/components/Modal';
import { ModalContent } from './components/ModalContent';
import { spacingCss } from 'code/components/css';

type Props = {
    mapStore: MapStore;
    createNewMap: (id: string, name: string, w: number, h: number) => void;
};

export const MapEditor = ({ mapStore, createNewMap }: Props) => {
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

            <Modal
                title={_('Create new map')}
                open={mapStore.openNewMapModal !== null}
                onClose={() => mapStore.setOpenNewMapModal(null)}
            >
                <ModalContent
                    onSubmit={(
                        id: string,
                        name: string,
                        w: number,
                        h: number
                    ) => {
                        createNewMap(id, name, w, h);
                    }}
                />
            </Modal>
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
    width: 100%;
    background-color: grey;
    z-index: 100;
    padding: ${spacingCss(1)};
    gap: ${spacingCss(1)};
`;
