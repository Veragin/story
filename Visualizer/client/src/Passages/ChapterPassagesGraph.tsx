import { styled } from '@mui/material';
import { useVisualizerStore } from '../context';
import { useEffect, useRef } from 'react';
import { assertNotNullish } from '@story/shared';
import { TChapterId } from '@story/types';
import { GraphAnimationHandler } from '../GUIComponents/Graphs/animation/GraphAnimationHandler';
import { CanvasManager } from '../GUIComponents/Canvas/CanvasManager/CanvasManager';
import { GraphProvider } from '../GUIComponents/Graphs/ChapterPassagesGraph/store/ChapterPassageGraphProvider';

type Props = {
    chapterId: TChapterId;
};

export const ChapterPassagesGraph = ({ chapterId }: Props) => {
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

            // Clear previous graph and animation
            if (graphAnimationHandlerRef.current) {
                graphAnimationHandlerRef.current.stopAnimation();
                graphAnimationHandlerRef.current = null;
            }

            try {
                const graph = await GraphProvider.getGraph(
                    chapterId,
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
        };

        void initGraph();

        return () => {
            isActive = false;
            store.canvasHandler.unregisterCanvas('passages');
            canvasManager.destroy();

            if (graphAnimationHandlerRef.current) {
                graphAnimationHandlerRef.current.stopAnimation();
                graphAnimationHandlerRef.current = null;
            }
        };
    }, [chapterId, store]);

    return <SMainCanvas ref={mainCanvasRef} />;
};

const SMainCanvas = styled('canvas')`
    width: 100%;
    height: 100%;
    overflow: hidden;
    background-color: wheat;
`;
