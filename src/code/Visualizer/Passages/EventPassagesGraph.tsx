import { styled } from '@mui/material';
import { useVisualizerStore } from 'code/Context';
import { useEffect, useRef } from 'react';
import { assertNotNullish } from 'code/utils/typeguards';
import { register } from 'data/register';
import { GraphAnimationHandler } from '../Graphs/animation.ts/GraphAnimationHandler';
import { TEventId } from 'types/TIds';
import { CanvasManager } from '../Graphs/CanvasManager';
import { GraphProvider } from '../Graphs/EventPassagesGraph/store/EventPassageGraphProvider';

type Props = {
    eventId: TEventId;
};

export const EventPassagesGraph = ({ eventId }: Props) => {
    const store = useVisualizerStore();
    const mainCanvasRef = useRef<HTMLCanvasElement>(null);
    const graphAnimationHandlerRef = useRef<GraphAnimationHandler | null>(null);

    useEffect(() => {
        let isActive = true;
        const canvas = mainCanvasRef.current;

        assertNotNullish(canvas);
        store.canvasHandler.registerCanvas('passages', canvas);
        const canvasManager = new CanvasManager(canvas);

        const initGraph = async () => {
            if (!isActive) return;
            assertNotNullish(store.activeTab);

            // Clear previous graph and animation
            if (graphAnimationHandlerRef.current) {
                graphAnimationHandlerRef.current.stopAnimation();
                graphAnimationHandlerRef.current = null;
            }

            if (register.passages[eventId]) {
                try {
                    const graph = await GraphProvider.getGraph(
                        eventId,
                        canvasManager,
                        store
                    );

                    if (!isActive) return;

                    graphAnimationHandlerRef.current =
                        new GraphAnimationHandler(graph, canvasManager);
                    graphAnimationHandlerRef.current.isAnimating();
                    graphAnimationHandlerRef.current.startAnimation();
                } catch (error) {
                    console.error('Failed to initialize graph:', error);
                }
            }
        };

        initGraph();

        return () => {
            isActive = false;
            store.canvasHandler.unregisterCanvas('passages');
            canvasManager.destroy();

            if (graphAnimationHandlerRef.current) {
                graphAnimationHandlerRef.current.stopAnimation();
                graphAnimationHandlerRef.current = null;
            }
        };
    }, [eventId, store.activeTab, store]);

    return <SMainCanvas ref={mainCanvasRef} />;
};

const SMainCanvas = styled('canvas')`
    width: 100%;
    height: 100%;
    overflow: hidden;
    background-color: wheat;
`;