import { observer } from 'mobx-react-lite';
import styled from '@emotion/styled';
import { Slider, Tooltip } from '@mui/material';
import { spacingCss } from '@story/ui';
import type { MapStore } from '../MapStore';
import { MAX_BRUSH_SIZE } from '../MapEngine/constants';

export const BrushSizeSlider = observer(
    ({ mapStore }: { mapStore: MapStore }) => (
        <Tooltip
            title={_('Brush size: %d', mapStore.brushSize)}
            placement="left"
        >
            <SSlider
                size="small"
                min={1}
                max={MAX_BRUSH_SIZE}
                step={1}
                value={mapStore.brushSize}
                onChange={(_e, v) =>
                    mapStore.setBrushSize(Array.isArray(v) ? v[0] : v)
                }
                aria-label={_('Brush size')}
            />
        </Tooltip>
    )
);

const SSlider = styled(Slider)`
    margin: 0 ${spacingCss(1)};
`;
