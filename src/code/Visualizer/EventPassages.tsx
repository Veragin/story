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
import { assertNotNullish } from 'code/utils/typeguards';
import { PassageGraphCreator } from './Graphs/PassagesGraph/PassageGraphCreator';
import { register } from 'data/register';
import { CanvasManager } from './Graphs/CanvasManager';
import { Store } from './ts/Store';
import { GraphAnimationHandler } from './Graphs/animation.ts/GraphAnimationHandler';
export const EventPassages = () => {
    const store = useVisualizerStore();
    const containerRef = useRef<HTMLDivElement>(null);
    const mainCanvasRef = useRef<HTMLCanvasElement>(null);
    const timelineCanvasRef = useRef<HTMLCanvasElement>(null);
    const markerRef = useRef<HTMLDivElement>(null);
    const graphAnimationHandlerRef = useRef<GraphAnimationHandler | null>(null);

    useEffect(() => {
        assertNotNullish(mainCanvasRef.current);
        assertNotNullish(timelineCanvasRef.current);
        assertNotNullish(containerRef.current);
        assertNotNullish(markerRef.current);

        let isActive = true;  // Flag to track if effect is still active

        const initGraph = async () => {
            if (!isActive) return;  // Check if still active before proceeding

            store.init(
                mainCanvasRef.current!,
                timelineCanvasRef.current!,
                containerRef.current!,
                markerRef.current!
            );

            const canvasManager = store.timelineEvents?.canvasManager;
            if (!canvasManager) return;

            const canvasWidth = canvasManager.getWidth();
            const canvasHeight = canvasManager.getHeight();
            if (!canvasWidth || !canvasHeight) return;

            const eventId = 'village';

            // Create graph
            if (register.passages[eventId]) {
                const graphCreator = new PassageGraphCreator(
                    canvasManager,
                    canvasWidth,
                    canvasHeight
                );
                const passages = await register.passages[eventId]();
                if (!isActive) return;  // Check again after async operation

                const graph = await graphCreator.createGraph(passages.default);
                if (!isActive) return;  // Check again after async operation

                graphAnimationHandlerRef.current = new GraphAnimationHandler(graph);
                graphAnimationHandlerRef.current.startAnimation();
            }
        };

        initGraph();

        // Cleanup function
        return () => {
            isActive = false;  // Mark effect as inactive
            if (graphAnimationHandlerRef.current) {
                graphAnimationHandlerRef.current.stopAnimation();
                graphAnimationHandlerRef.current = null;
            }
            store.deinit();
        };
    }, []); // Empty dependency array

    return (
        <WholeContainer ref={containerRef}>
            <SControlPanel>
                <SmallText>Event Timeline</SmallText>
                <Button
                    variant="contained"
                    onClick={() => console.log('Add event')}
                >
                    Expand connections
                </Button>
            </SControlPanel>
            <SMainCanvas ref={mainCanvasRef} />
            <STimelineCanvas ref={timelineCanvasRef} />
            <STimelineTimeMarker ref={markerRef} />
        </WholeContainer>
    );
};


const createPassageGraph = async (
    canvasManager: CanvasManager,
    canvasWidth: number,
    canvasHeight: number,
    store: Store,
    eventId: keyof typeof register.passages
) => {
    // Create graph from event passages
    if (register.passages[eventId as keyof typeof register.passages]) {
        const graphCreator = new PassageGraphCreator(
            canvasManager,
            canvasWidth,
            canvasHeight
        );
        const passages = await register.passages[eventId]();
        const graph = await  graphCreator.createGraph(passages.default);
        const graphAnimationHandler = new GraphAnimationHandler(graph);
        graphAnimationHandler.startAnimation();
        

    } else {
        console.error(`No passages found for event '${eventId}'`);
    }

    return () => {
        store.deinit();
    };
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
