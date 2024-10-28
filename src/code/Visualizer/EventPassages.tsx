import { Button, styled } from '@mui/material';
import { Row, WholeContainer } from 'code/Components/Basic';
import { spacingCss } from 'code/Components/css';
import { SmallText } from 'code/Components/Text';
import { useVisualizerStore } from 'code/Context';
import {
    MARKER_LINE_CLASS,
    MARKER_TIME_CLASS,
} from './ts/TimelineRender/TimelineMarker';
import { useEffect, useRef } from 'react';
import { GraphGenerator } from './Graphs/GraphGenerator';
import { assertNotNullish } from 'code/utils/typeguards';

export const EventPassages = () => {
    const store = useVisualizerStore();
    const containerRef = useRef<HTMLDivElement>(null);
    const mainCanvasRef = useRef<HTMLCanvasElement>(null);
    const timelineCanvasRef = useRef<HTMLCanvasElement>(null);
    const markerRef = useRef<HTMLDivElement>(null);

    // Set timeline canvas in store
    useEffect(() => {
        assertNotNullish(mainCanvasRef.current);
        assertNotNullish(timelineCanvasRef.current);
        assertNotNullish(containerRef.current);
        assertNotNullish(markerRef.current);

        store.init(
            mainCanvasRef.current,
            timelineCanvasRef.current,
            containerRef.current,
            markerRef.current
        );

        const generator = new GraphGenerator(store.canvasManager!);
        generator.generate({
            nodeCount: 300,
            edgeCount: 1000,
            layout: 'circular',
            canvasWidth: 800,
            canvasHeight: 600,
        });

        return () => {
            store.deinit();
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
            <STimelineTimeMarker ref={markerRef} />
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
    background-color: wheat;
`;

const STimelineCanvas = styled('canvas')`
    width: 100%;
    height: 80px;
    user-select: none;
    cursor: grab;

    &.grabbing {
        cursor: grabbing;
    }
`;

const STimelineTimeMarker = styled('div')`
    position: absolute;
    bottom: 42px;
    left: 0;
    width: 150px;
    align-items: center;
    display: none;
    flex-direction: column;
    pointer-events: none;
    gap: ${spacingCss(1)};
    translate: -50%;

    & > .${MARKER_TIME_CLASS} {
        background-color: #171a1e;
        padding: ${spacingCss(0.5)} ${spacingCss(1)};
        border-radius: 6px;
        font-size: 14px;
        line-height: 14px;
        align-self: stretch;
        text-align: center;
    }

    & > .${MARKER_LINE_CLASS} {
        background-color: red;
        width: 2px;
        height: 30px;
    }
`;
