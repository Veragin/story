import { styled, FormControl, Autocomplete, TextField } from '@mui/material';
import { Row, WholeContainer } from 'code/Components/Basic';
import { spacingCss } from 'code/Components/css';
import { SmallText } from 'code/Components/Text';
import { useVisualizerStore } from 'code/Context';
import {
    MARKER_LINE_CLASS,
    MARKER_TIME_CLASS,
} from './ts/TimelineRender/TimelineMarker';
import { useEffect, useRef, useState } from 'react';
import { assertNotNullish } from 'code/utils/typeguards';
import { register } from 'data/register';
import { GraphAnimationHandler } from './Graphs/animation.ts/GraphAnimationHandler';
import { EventPassagesGraphStorageManager } from './Graphs/EventPassagesGraph/store/EventPassagesGraphStorageManager';


export const EventPassages = () => {
    const store = useVisualizerStore();
    const containerRef = useRef<HTMLDivElement>(null);
    const mainCanvasRef = useRef<HTMLCanvasElement>(null);
    const timelineCanvasRef = useRef<HTMLCanvasElement>(null);
    const markerRef = useRef<HTMLDivElement>(null);
    const graphAnimationHandlerRef = useRef<GraphAnimationHandler | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<string>('village');

    // Get all available events from register
    const events = Object.entries(register.events).map(([id, event]) => ({
        id,
        title: event.title
    }));

    useEffect(() => {
        assertNotNullish(mainCanvasRef.current);
        assertNotNullish(timelineCanvasRef.current);
        assertNotNullish(containerRef.current);
        assertNotNullish(markerRef.current);

        let isActive = true;

        const initGraph = async () => {
            if (!isActive) 
                return;
        
            store.init(
                mainCanvasRef.current!,
                timelineCanvasRef.current!,
                containerRef.current!,
                markerRef.current!
            );
        
            const canvasManager = store.canvasManager;
            if (!canvasManager) 
                return;
        
            const canvasWidth = canvasManager.getWidth();
            const canvasHeight = canvasManager.getHeight();
            if (!canvasWidth || !canvasHeight) 
                return;
        
            // Clear previous graph and animation
            if (graphAnimationHandlerRef.current) {
                graphAnimationHandlerRef.current.stopAnimation();
                graphAnimationHandlerRef.current = null;
            }
        
            if (register.passages[selectedEvent as keyof typeof register.passages]) {
                try {
                    const graph = await EventPassagesGraphStorageManager.getGraph(
                        selectedEvent,
                        canvasManager,
                        canvasWidth,
                        canvasHeight
                    );
        
                    if (!isActive) 
                        return;
        
                    graphAnimationHandlerRef.current = new GraphAnimationHandler(graph, canvasManager);
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
            if (graphAnimationHandlerRef.current) {
                graphAnimationHandlerRef.current.stopAnimation();
                graphAnimationHandlerRef.current = null;
            }
            store.deinit();
        };
    }, [selectedEvent, store]);

    return (
        <WholeContainer ref={containerRef}>
            <SControlPanel>
                <SmallText>Event Passages</SmallText>
                <SFormControl size="small">
                    <Autocomplete
                        value={events.find(event => event.id === selectedEvent) || null}
                        onChange={(_, newValue) => {
                            if (newValue) {
                                setSelectedEvent(newValue.id);
                            }
                        }}
                        options={events}
                        getOptionLabel={(option) => option.title || option.id}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Select Event"
                                variant="outlined"
                            />
                        )}
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                        sx={{
                            minWidth: 300,
                            '& .MuiOutlinedInput-root': {
                                backgroundColor: 'gray'
                            }
                        }}
                    />
                </SFormControl>
            </SControlPanel>
            <SMainCanvas ref={mainCanvasRef} />
            <STimelineCanvas ref={timelineCanvasRef} style={{ visibility: 'hidden' }} />
            <STimelineTimeMarker ref={markerRef} style={{ visibility: 'hidden' }} />
        </WholeContainer>
    );
};

const SControlPanel = styled(Row)`
    gap: ${spacingCss(2)};
    align-items: center;
    padding: ${spacingCss(0.5)}; // Reduced from 1 to 0.5
    background-color: gray;
    border-bottom: 1px solid rgba(0, 0, 0, 0.12);
    height: 52px; 
    padding-left: ${spacingCss(2)};
`;

const SFormControl = styled(FormControl)`
    min-width: 200px;
    margin: 0; // Removed vertical margin
    
    // Style for text field and autocomplete
    & .MuiAutocomplete-root {
        & .MuiOutlinedInput-root {
            background-color: gray;
            height: 40px;
            padding: 0 ${spacingCss(2)}; 
            
            & input {
                color: rgba(0, 0, 0, 0.87);
                padding: 0; 
                height: 100%;
            }

            & .MuiAutocomplete-endAdornment {
                color: rgba(0, 0, 0, 0.54);
                top: 50%; // Center vertically
                transform: translateY(-50%);
            }
        }
    }

    // Adjust label position for the smaller height
    & .MuiInputLabel-root {
        color: white;
        background-color: black;
        border-radius: 4px;
        padding: 0 ${spacingCss(0.5)};
        transform: translate(14px, -6px) scale(0.75); // Adjusted position
        
        &.Mui-focused {
            color: white;
        }
    }
    
    & .MuiOutlinedInput-notchedOutline {
        border-color: rgba(0, 0, 0, 0.23);
    }

    // Improve hover and focus states
    & .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline {
        border-color: rgba(0, 0, 0, 0.87);
    }
    
    & .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline {
        border-color: black;
    }

    // Style for the label
    & .MuiInputLabel-root {
        color: white;
        background-color: black;
        border-radius: 4px;
        padding: 0 ${spacingCss(0.5)};
        
        &.Mui-focused {
            color: white;
        }
    }

    // Style for the dropdown menu
    & .MuiAutocomplete-popper {
        & .MuiPaper-root {
            background-color: gray;
            color: rgba(0, 0, 0, 0.87);
            margin-top: 4px;
        }

        & .MuiAutocomplete-option {
            padding: ${spacingCss(1)};
            
            &:hover {
                background-color: rgba(0, 0, 0, 0.1);
            }
            &[aria-selected="true"] {
                background-color: rgba(0, 0, 0, 0.2);
            }
            &[aria-selected="true"].Mui-focused {
                background-color: rgba(0, 0, 0, 0.3);
            }
        }

        & .MuiAutocomplete-noOptions {
            padding: ${spacingCss(1)};
            color: rgba(0, 0, 0, 0.6);
        }
    }
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