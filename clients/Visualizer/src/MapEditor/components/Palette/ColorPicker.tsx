import { observer } from 'mobx-react-lite';
import { IconButton, Tooltip } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { Row } from '@story/ui';
import type { MapStore } from '../../MapStore';
import { ToolSection } from '../ToolWindow/ToolSection';
import { List } from './List';
import { Color } from './Color';
import { BrushSizeSlider } from '../BrushSizeSlider';

type Props = {
    mapStore: MapStore;
    onOpenTileTypeForm: (id?: string) => void;
    onDeleteColor: () => void;
};

export const ColorPicker = observer(
    ({ mapStore, onOpenTileTypeForm, onDeleteColor }: Props) => {
        void mapStore.revision;
        const palette = mapStore.data?.palette ?? {};

        return (
            <ToolSection
                label={<BrushSizeSlider mapStore={mapStore} />}
                actions={
                    <Row>
                        <Tooltip title={_('Add tile type')}>
                            <IconButton
                                size="small"
                                color="inherit"
                                onClick={() => onOpenTileTypeForm()}
                                aria-label={_('Add tile type')}
                            >
                                <AddRoundedIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title={_('Edit tile type')}>
                            <IconButton
                                size="small"
                                color="inherit"
                                onClick={() =>
                                    onOpenTileTypeForm(mapStore.selectedColorId)
                                }
                                aria-label={_('Edit tile type')}
                            >
                                <EditRoundedIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title={_('Delete tile type')}>
                            <span>
                                <IconButton
                                    size="small"
                                    color="error"
                                    disabled={
                                        mapStore.selectedColorId === 'none'
                                    }
                                    onClick={onDeleteColor}
                                    aria-label={_('Delete tile type')}
                                >
                                    <DeleteRoundedIcon fontSize="small" />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Row>
                }
            >
                <List role="listbox" aria-label={_('Tile type')}>
                    {Object.entries(palette).map(([colorId, entry]) => (
                        <Color
                            key={colorId}
                            color={entry.color}
                            name={entry.name}
                            isActive={mapStore.selectedColorId === colorId}
                            onClick={() => mapStore.setSelectedColorId(colorId)}
                        />
                    ))}
                </List>
            </ToolSection>
        );
    }
);
