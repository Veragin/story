import { observer } from 'mobx-react-lite';
import EditIcon from '@mui/icons-material/Edit';
import { Row } from '@story/ui';
import { AddButton } from '../../../components/buttons/AddButton';
import { DeleteButton } from '../../../components/buttons/DeleteButton';
import { TooltipIconButton } from '../../../components/buttons/TooltipIconButton';
import type { MapStore } from '../../MapStore';
import { PanelSection } from '../../../components/layout/PanelSection';
import { List } from './List';
import { Color } from './Color';
import { BrushSizeSlider } from '../BrushSizeSlider';

type TProps = {
    mapStore: MapStore;
    onOpenTileTypeForm: (id?: string) => void;
    onDeleteColor: () => void;
};

export const ColorPicker = observer(
    ({ mapStore, onOpenTileTypeForm, onDeleteColor }: TProps) => {
        void mapStore.revision;
        const palette = mapStore.data?.palette ?? {};

        return (
            <PanelSection
                label={<BrushSizeSlider mapStore={mapStore} />}
                actions={
                    <Row>
                        <AddButton
                            iconOnly
                            label={_('Add tile type')}
                            tone="inherit"
                            onClick={() => onOpenTileTypeForm()}
                        />
                        <TooltipIconButton
                            title={_('Edit tile type')}
                            icon={EditIcon}
                            tone="inherit"
                            onClick={() =>
                                onOpenTileTypeForm(mapStore.selectedColorId)
                            }
                        />
                        <DeleteButton
                            iconOnly
                            label={_('Delete tile type')}
                            tone="error"
                            disabled={mapStore.selectedColorId === 'none'}
                            onClick={onDeleteColor}
                        />
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
            </PanelSection>
        );
    }
);
