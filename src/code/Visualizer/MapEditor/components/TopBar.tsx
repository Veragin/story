import { IconButton, Tooltip } from '@mui/material';
import { useVisualizerStore } from 'code/Context';
import { Nav, NavPicker } from 'code/Visualizer/components/Nav';
import { ZoomSlider } from 'code/Visualizer/components/ZoomSlider';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import EditIcon from '@mui/icons-material/Edit';
import { MapStore } from '../MapStore';
import { observer } from 'mobx-react-lite';

type Props = {
    mapStore?: MapStore | null;
};

export const TopBar = observer(({ mapStore }: Props) => {
    const store = useVisualizerStore();

    return (
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
                    onClick={() => mapStore?.setEditMode(!mapStore?.editMode)}
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
    );
});
