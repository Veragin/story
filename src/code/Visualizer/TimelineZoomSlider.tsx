import { Slider, styled, Tooltip } from '@mui/material';
import { useVisualizerStore } from 'code/Context';
import { observer } from 'mobx-react-lite';
import { ZOOM_CONFIG } from './ts/EventStore/TimelineRender/zoomConfig';
import { Row } from 'code/Components/Basic';

export const TimelineZoomSlider = observer(() => {
    const store = useVisualizerStore();
    return (
        <SRow>
            <Tooltip title={_('Zoom level')}>
                <Slider
                    value={store.zoomLevel}
                    min={0}
                    max={ZOOM_CONFIG.length - 1}
                    marks
                    step={1}
                    onChange={(_, l) =>
                        store.setZoomLevel(Array.isArray(l) ? l[0] : l)
                    }
                />
            </Tooltip>
        </SRow>
    );
});

const SRow = styled(Row)`
    width: 140px;
    gap: 12px;
    align-items: center;
`;
