import { Row } from 'code/components/Basic';
import styled from '@emotion/styled';
import { MapStore } from './MapStore';
import { useEffect, useRef } from 'react';
import { Modal } from 'code/components/Modal';
import { ModalContent } from './components/ModalContent';
import { spacingCss } from 'code/components/css';
import { IconButton, Tooltip } from '@mui/material';
import MapIcon from '@mui/icons-material/Map';
import PaletteIcon from '@mui/icons-material/Palette';
import { observer } from 'mobx-react-lite';
import { Palette } from './components/Palette/Palette';
import PresentToAllIcon from '@mui/icons-material/PresentToAll';
import EditIcon from '@mui/icons-material/Edit';
import { EditWidget } from './components/EditWidget';

type Props = {
    mapStore: MapStore;
    createNewMap: (id: string, name: string, w: number, h: number) => void;
};

export const MapEditor = observer(({ mapStore, createNewMap }: Props) => {
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
            <SRow>
                <Tooltip title={_('Minimap')}>
                    <IconButton
                        size="small"
                        color={mapStore.showMinimap ? 'secondary' : 'inherit'}
                        onClick={() => mapStore.toggleShowMinimap()}
                    >
                        <MapIcon />
                    </IconButton>
                </Tooltip>
                <Tooltip title={_('Palette mode')}>
                    <IconButton
                        size="small"
                        color={
                            mapStore.mode === 'palette'
                                ? 'secondary'
                                : 'inherit'
                        }
                        onClick={() => mapStore.setMode('palette')}
                    >
                        <PaletteIcon />
                    </IconButton>
                </Tooltip>
                <Tooltip title={_('Edit mode')}>
                    <IconButton
                        size="small"
                        color={
                            mapStore.mode === 'edit' ? 'secondary' : 'inherit'
                        }
                        onClick={() => mapStore.setMode('edit')}
                    >
                        <EditIcon />
                    </IconButton>
                </Tooltip>
                <Tooltip title={_('Presentation mode')}>
                    <IconButton
                        size="small"
                        color={
                            mapStore.mode === 'presentation'
                                ? 'secondary'
                                : 'inherit'
                        }
                        onClick={() => mapStore.setMode('presentation')}
                    >
                        <PresentToAllIcon />
                    </IconButton>
                </Tooltip>
                <SSRow ref={infoRef}></SSRow>
            </SRow>

            <Palette mapStore={mapStore} />
            <EditWidget mapStore={mapStore} />

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
});

const SCanvas = styled.canvas`
    width: 100%;
    height: 100%;
    background-color: #000;
    overflow: hidden;
`;

const SRow = styled(Row)`
    width: 100%;
    background-color: #999;
    z-index: 100;
    padding: 0 ${spacingCss(1)};
    gap: ${spacingCss(1)};
    align-items: center;
`;

const SSRow = styled(Row)`
    gap: ${spacingCss(1.5)};
    align-items: center;
`;
