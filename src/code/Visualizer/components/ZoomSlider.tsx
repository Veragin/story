import { Slider, styled, Tooltip } from '@mui/material';
import { ZOOM_CONFIG } from '../Events/EventStore/TimelineRender/zoomConfig';
import { Row } from 'code/components/Basic';

type Props = {
    zoomLevel: number;
    setZoomLevel?: (zoomLevel: number) => void;
};

export const ZoomSlider = ({ zoomLevel, setZoomLevel }: Props) => {
    return (
        <SRow>
            <Tooltip title={_('Zoom level')}>
                <Slider
                    value={zoomLevel}
                    min={0}
                    max={ZOOM_CONFIG.length - 1}
                    marks
                    step={1}
                    onChange={(_, l) =>
                        setZoomLevel?.(Array.isArray(l) ? l[0] : l)
                    }
                />
            </Tooltip>
        </SRow>
    );
};

const SRow = styled(Row)`
    width: 140px;
    gap: 12px;
    align-items: center;
`;
