import { Button, styled } from '@mui/material';
import { Row, WholeContainer } from 'code/Components/Basic';
import { spacingCss } from 'code/Components/css';
import { SmallText } from 'code/Components/Text';
import { useVisualizerStore } from 'code/Context';
import { useEffect, useRef } from 'react';

export const EventTimeline = () => {
    const store = useVisualizerStore();
    const containerRef = useRef<HTMLDivElement>(null);
    const mainCanvasRef = useRef<HTMLCanvasElement>(null);
    const timelineCanvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        store.setTimeRenderer(
            timelineCanvasRef.current!,
            containerRef.current!
        );
        return () => {
            store.timelineRender?.destructor();
        };
    }, []);

    return (
        <WholeContainer ref={containerRef}>
            <SControlPanel>
                <SmallText>{_('Event Timeline')}</SmallText>
                <Button
                    variant="contained"
                    onClick={() => console.log('Add event')}
                >
                    {_('Expand connections')}
                </Button>
            </SControlPanel>
            <SMainCanvas ref={mainCanvasRef} />
            <STimelineCanvas ref={timelineCanvasRef} />
        </WholeContainer>
    );
};

const SControlPanel = styled(Row)`
    gap: ${spacingCss(1)};
    align-items: center;
`;

const SMainCanvas = styled('canvas')`
    flex: 1;
    overflow: hidden;
    border-top: 1px solid grey;
    border-bottom: 1px solid grey;
`;

const STimelineCanvas = styled('canvas')`
    width: 100%;
    height: 80px;
    user-select: none;
    cursor: pointer;
`;
