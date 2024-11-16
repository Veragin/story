import {
    styled,
    FormControl,
    Autocomplete,
    TextField,
    Button,
} from '@mui/material';
import { WholeContainer } from 'code/Components/Basic';
import { spacingCss } from 'code/Components/css';
import { SmallText } from 'code/Components/Text';
import { useVisualizerStore } from 'code/Context';
import { useEffect, useRef } from 'react';
import { assertNotNullish } from 'code/utils/typeguards';
import { register } from 'data/register';
import { GraphAnimationHandler } from './Graphs/animation.ts/GraphAnimationHandler';
import { EventPassagesGraphStorageManager } from './Graphs/EventPassagesGraph/store/EventPassagesGraphStorageManager';
import { Nav } from './components/Nav';
import { TEventId } from 'types/TIds';
import { CanvasManager } from './Graphs/CanvasManager';

export const EventPassages = () => {
    const store = useVisualizerStore();
    const mainCanvasRef = useRef<HTMLCanvasElement>(null);
    const graphAnimationHandlerRef = useRef<GraphAnimationHandler | null>(null);

    // Get all available events from register
    const events = Object.entries(register.events).map(([id, event]) => ({
        id: id as TEventId,
        title: event.title,
    }));

    useEffect(() => {
        let isActive = true;

        const initGraph = async () => {
            if (!isActive) return;

            assertNotNullish(mainCanvasRef.current);
            assertNotNullish(store.activeEvent);
            store.canvasHandler.registerCanvas(
                'passages',
                mainCanvasRef.current
            );
            const canvasManager = new CanvasManager(mainCanvasRef.current);

            // Clear previous graph and animation
            if (graphAnimationHandlerRef.current) {
                graphAnimationHandlerRef.current.stopAnimation();
                graphAnimationHandlerRef.current = null;
            }

            if (
                register.passages[
                    store.activeEvent as keyof typeof register.passages
                ]
            ) {
                try {
                    const graph =
                        await EventPassagesGraphStorageManager.getGraph(
                            store.activeEvent,
                            canvasManager
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
            if (graphAnimationHandlerRef.current) {
                graphAnimationHandlerRef.current.stopAnimation();
                graphAnimationHandlerRef.current = null;
            }
        };
    }, [store.activeEvent, store]);

    return (
        <WholeContainer>
            <Nav>
                <Button
                    variant={'text'}
                    onClick={() => store.setActiveEvent(null)}
                >
                    {_('Back')}
                </Button>
                <SmallText>{_('Event Passages')}</SmallText>

                <SFormControl size="small">
                    <Autocomplete
                        value={
                            events.find(
                                (event) => event.id === store.activeEvent
                            ) ?? null
                        }
                        onChange={(_, newValue) => {
                            store.setActiveEvent(newValue?.id ?? null);
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
                        isOptionEqualToValue={(option, value) =>
                            option.id === value.id
                        }
                        sx={{
                            'minWidth': 300,
                            '& .MuiOutlinedInput-root': {
                                backgroundColor: 'gray',
                            },
                        }}
                    />
                </SFormControl>
            </Nav>
            <SMainCanvas ref={mainCanvasRef} />
        </WholeContainer>
    );
};

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
            &[aria-selected='true'] {
                background-color: rgba(0, 0, 0, 0.2);
            }
            &[aria-selected='true'].Mui-focused {
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
