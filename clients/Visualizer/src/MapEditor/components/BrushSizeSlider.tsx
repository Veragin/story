import { observer } from 'mobx-react-lite';
import { styled, Tooltip } from '@mui/material';
import { SliderInput } from '../../components/inputs/SliderInput';
import type { MapStore } from '../MapStore';
import { MAX_BRUSH_SIZE } from '../MapEngine/constants';

export const BrushSizeSlider = observer(
    ({ mapStore }: { mapStore: MapStore }) => (
        <Tooltip
            title={_('Brush size: %d', mapStore.brushSize)}
            placement="left"
        >
            <SBrush>
                <SliderInput
                    min={1}
                    max={MAX_BRUSH_SIZE}
                    value={mapStore.brushSize}
                    onChange={(size) => mapStore.setBrushSize(size)}
                    ariaLabel={_('Brush size')}
                />
            </SBrush>
        </Tooltip>
    )
);

const SBrush = styled('span')`
    display: block;
    width: 100%;
`;
