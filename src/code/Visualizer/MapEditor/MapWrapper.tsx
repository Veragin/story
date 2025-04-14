import { Column, Row, WholeContainer } from 'code/components/Basic';
import { useEffect, useState } from 'react';
import { Nav, NavPicker } from '../components/Nav';
import { Button, IconButton, Tooltip } from '@mui/material';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import { ZoomSlider } from '../components/ZoomSlider';
import { MapStore } from './MapStore';
import { useVisualizerStore } from 'code/Context';
import EditIcon from '@mui/icons-material/Edit';
import { Modal } from 'code/components/Modal';
import styled from '@emotion/styled';
import { TMapData } from './types';
import { MapEditor } from './MapEditor';
import { TextField } from '../components/TextField';

type Props = {
    mapId: string;
};

export const MapWrapper = ({ mapId }: Props) => {
    const store = useVisualizerStore();
    const [mapStore, setMapStore] = useState<MapStore | null>(null);
    const [openNewModal, setOpenNewModal] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const data = await store.agent.getMap(mapId);
                setMapStore(new MapStore(store.canvasHandler, data));
            } catch {
                setOpenNewModal(true);
            }
        })();
    }, [mapId]);

    return (
        <WholeContainer>
            <Nav>
                <NavPicker />

                <Tooltip
                    title={
                        mapStore?.editMode
                            ? _('Disable edit mode')
                            : _('Enable edit mode')
                    }
                >
                    <IconButton
                        onClick={() =>
                            mapStore?.setEditMode(!mapStore?.editMode)
                        }
                        color={mapStore?.editMode ? 'primary' : 'secondary'}
                    >
                        <EditIcon />
                    </IconButton>
                </Tooltip>
                <Tooltip title={_('Save map')}>
                    <IconButton
                        onClick={() =>
                            mapStore && store.agent.saveMap(mapStore.data)
                        }
                        color={'primary'}
                    >
                        <SaveAltIcon />
                    </IconButton>
                </Tooltip>
                <ZoomSlider
                    zoomLevel={mapStore?.zoomLevel ?? 0}
                    setZoomLevel={mapStore?.setZoomLevel}
                />
            </Nav>

            {mapStore && (
                <MapEditor
                    mapStore={mapStore}
                    createNewMap={() => setOpenNewModal(true)}
                />
            )}

            <Modal
                title={_('Create new map')}
                open={openNewModal}
                onClose={() => setOpenNewModal(false)}
            >
                <ModalContent
                    onSubmit={async (name: string, w: number, h: number) => {
                        const data: TMapData['data'] = [];
                        for (let i = 0; i < w; i++) {
                            const row = [];
                            for (let j = 0; j < h; j++) {
                                row.push({
                                    tile: 'none',
                                });
                            }
                            data.push(row);
                        }
                        const newMapStore = new MapStore(store.canvasHandler, {
                            mapId: 'new',
                            title: name,
                            width: w,
                            height: h,
                            data,
                            locations: [],
                            maps: [],
                        });
                        setMapStore(newMapStore);
                        setOpenNewModal(false);
                    }}
                />
            </Modal>
        </WholeContainer>
    );
};

const ModalContent = ({
    onSubmit,
}: {
    onSubmit: (name: string, w: number, h: number) => void;
}) => {
    const [id, setId] = useState('');
    const [name, setName] = useState('');
    const [width, setWidth] = useState(100);
    const [height, setHeight] = useState(100);

    return (
        <SColumn>
            <TextField
                value={id}
                onChange={(e) => setId(e.target.value)}
                label={_('Map id')}
                color="info"
                variant="outlined"
                fullWidth
            />
            <TextField
                value={name}
                onChange={(e) => setName(e.target.value)}
                label={_('Map name')}
                variant="outlined"
                fullWidth
            />
            <TextField
                value={width}
                onChange={(e) =>
                    setWidth(
                        isNaN(parseInt(e.target.value))
                            ? 0
                            : parseInt(e.target.value)
                    )
                }
                label={_('Map width')}
                variant="outlined"
                fullWidth
            />
            <TextField
                value={height}
                onChange={(e) =>
                    setHeight(
                        isNaN(parseInt(e.target.value))
                            ? 0
                            : parseInt(e.target.value)
                    )
                }
                label={_('Map height')}
                variant="outlined"
                fullWidth
            />
            <SRow>
                <Button
                    onClick={() => onSubmit(name, width, height)}
                    variant="contained"
                >
                    {_('Create')}
                </Button>
            </SRow>
        </SColumn>
    );
};

const SColumn = styled(Column)`
    gap: 16px;
    color: white;
`;

const SRow = styled(Row)`
    align-self: stretch;
    justify-content: end;
`;
