import { Button, styled } from '@mui/material';
import { Column, Row } from 'code/Components/Basic';
import { spacingCss } from 'code/Components/css';
import { Text } from 'code/Components/Text';
import { useVisualizerStore } from 'code/Context';
import { useEffect, useRef } from 'react';

export const EventTimeline = () => {
    const store = useVisualizerStore();
    const mainCanvasRef = useRef<HTMLCanvasElement>(null);
    const timelineCanvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        store.timelineRender.canvas = timelineCanvasRef.current;
    }, []);

    return (
        <SCont>
            <SControlPanel>
                <Text>{_('Event Timeline')}</Text>
                <Button
                    variant="contained"
                    onClick={() => console.log('Add event')}
                >
                    {_('Expand connections')}
                </Button>
            </SControlPanel>
            <SMainCanvas ref={mainCanvasRef} />
            <STimelineCanvas ref={timelineCanvasRef} />
        </SCont>
    );
};

const SCont = styled(Column)`
    width: 100vw;
    height: 100vh;
    align-items: stretch;
`;

const SControlPanel = styled(Row)`
    gap: ${spacingCss(1)};
`;

const SMainCanvas = styled('canvas')`
    flex: 1;
`;

const STimelineCanvas = styled('canvas')`
    height: 100px;
`;
