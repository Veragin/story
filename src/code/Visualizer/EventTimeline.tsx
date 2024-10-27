import { Button, styled } from '@mui/material';
import { Row, WholeContainer } from 'code/Components/Basic';
import { spacingCss } from 'code/Components/css';
import { SmallText } from 'code/Components/Text';
import { useVisualizerStore } from 'code/Context';
import {
    MARKER_LINE_CLASS,
    MARKER_TIME_CLASS,
} from './ts/TimelineRender/TimelineMarker';
import { useEffect, useRef, useState } from 'react';
import { CanvasManager } from './Graphs/CanvasManager';
import { NodeVisualObject } from './Graphs/Node/NodeVisualObject';
import { GraphGenerator } from './Graphs/GraphGenerator';

export const EventTimeline = () => {
    const store = useVisualizerStore();
    const containerRef = useRef<HTMLDivElement>(null);
    const mainCanvasRef = useRef<HTMLCanvasElement>(null);
    const timelineCanvasRef = useRef<HTMLCanvasElement>(null);
    const markerRef = useRef<HTMLDivElement>(null);

    const canvasManagerRef = useRef<CanvasManager | null>(null);
    const [nodes, setNodes] = useState<NodeVisualObject[]>([]);
    void nodes;
    void setNodes;

    // Set background color of main canvas
    if (mainCanvasRef.current) {
        mainCanvasRef.current.style.backgroundColor = 'wheat';
    }

    // Initialize canvas manager and create nodes
    useEffect(() => {
        if (!mainCanvasRef.current) return;

        mainCanvasRef.current.style.backgroundColor = 'wheat';

        // Create canvas manager
        const canvasManager = new CanvasManager(mainCanvasRef.current);
        canvasManagerRef.current = canvasManager;


        // Generate a random graph
        const generator = new GraphGenerator(canvasManager);
        const graph = generator.generate({
            nodeCount: 10,
            edgeCount: 15,
            layout: 'circular',
            canvasWidth: 800,
            canvasHeight: 600,
        });


        // Handle canvas resize
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.target === mainCanvasRef.current) {
                    canvasManager.setSize(
                        entry.contentRect.width,
                        entry.contentRect.height
                    );
                }
            }
        });

        resizeObserver.observe(mainCanvasRef.current);

        // Cleanup
        return () => {
            resizeObserver.disconnect();
            canvasManager.destroy();
        };
    }, []);

    // Set timeline canvas in store
    useEffect(() => {
        store.setTimeRenderer(
            timelineCanvasRef.current!,
            containerRef.current!,
            markerRef.current!
        );
        return () => {
            store.timelineRender?.destructor();
        };
    }, []);

    // Handle window resize
    useEffect(() => {
        const handleResize = () => {
            if (mainCanvasRef.current && canvasManagerRef.current) {
                canvasManagerRef.current.setSize(
                    mainCanvasRef.current.offsetWidth,
                    mainCanvasRef.current.offsetHeight
                );
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
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
