import {
    styled,
    FormControl,
    Autocomplete,
    TextField,
    Button,
} from '@mui/material';
import { WholeContainer } from 'code/components/Basic';
import { spacingCss } from 'code/components/css';
import { useVisualizerStore } from 'code/Context';
import { useEffect, useRef } from 'react';
import { assertNotNullish } from 'code/utils/typeguards';
import { register } from 'data/register';
import { GraphAnimationHandler } from '../Graphs/animation.ts/GraphAnimationHandler';
import { EventPassagesGraphStorageManager } from '../Graphs/EventPassagesGraph/store/EventPassagesGraphStorageManager';
import { Nav } from '../components/Nav';
import { TEventId } from 'types/TIds';
import { CanvasManager } from '../Graphs/CanvasManager';

type Props = {
    eventId: TEventId;
};

export const EventPassages = ({ eventId }: Props) => {
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
                    const graph =
                        await EventPassagesGraphStorageManager.getGraph(
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
    }, [store.activeTab, store]);

    return (
        <WholeContainer>
            <Nav>
                <Button
                    color="inherit"
                    variant={'text'}
                    onClick={() => store.setActiveTab(null)}
                >
                    {_('Back')}
                </Button>

                <SFormControl size="small">
                    <Autocomplete
                        value={
                            events.find((event) => event.id === eventId) ?? null
                        }
                        onChange={(_, newValue) => {
                            store.setActiveTab(
                                newValue === null
                                    ? null
                                    : {
                                          tab: 'event',
                                          eventId: newValue.id,
                                      }
                            );
                        }}
                        options={events}
                        getOptionLabel={(option) => option.title || option.id}
                        renderInput={(params) => (
                            <TextField {...params} variant="outlined" />
                        )}
                        isOptionEqualToValue={(option, value) =>
                            option.id === value.id
                        }
                        sx={{
                            minWidth: 300,
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
            background-color: lightgray;
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
