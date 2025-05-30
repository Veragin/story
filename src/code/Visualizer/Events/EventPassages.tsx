import {
    styled,
    FormControl,
    Autocomplete,
    TextField,
    Button,
} from '@mui/material';
import { Column, Row, WholeContainer } from 'code/components/Basic';
import { spacingCss } from 'code/components/css';
import { useVisualizerStore } from 'code/Context';
import { register } from 'data/register';
import { Nav } from '../components/Nav';
import { TEventId } from 'types/TIds';
import { ResizableSplitter } from '../Passages/ResizableSplitter';
import { ScreenPassageCreationForm } from '../Passages/CreatePassageForm';
import { EventPassagesGraph } from '../Passages/EventPassagesGraph';

// We need to create a dark-themed wrapper for the form
const DarkThemedForm = styled('div')`
    height: 100%;
    
    /* Dark theme overrides for Material-UI components */
    & .MuiPaper-root {
        background-color: rgba(40, 40, 40, 0.9) !important;
        color: #ffffff !important;
    }
    
    & .MuiTypography-root {
        color: #ffffff !important;
    }
    
    & .MuiTypography-colorTextSecondary {
        color: rgba(255, 255, 255, 0.7) !important;
    }
    
    & .MuiOutlinedInput-root {
        background-color: rgba(50, 50, 50, 0.8) !important;
        color: #ffffff !important;
        
        & .MuiOutlinedInput-notchedOutline {
            border-color: rgba(255, 255, 255, 0.3) !important;
        }
        
        &:hover .MuiOutlinedInput-notchedOutline {
            border-color: rgba(255, 255, 255, 0.5) !important;
        }
        
        &.Mui-focused .MuiOutlinedInput-notchedOutline {
            border-color: #64b5f6 !important;
        }
    }
    
    & .MuiInputLabel-root {
        color: rgba(255, 255, 255, 0.7) !important;
        
        &.Mui-focused {
            color: #64b5f6 !important;
        }
    }
    
    & .MuiFormHelperText-root {
        color: rgba(255, 255, 255, 0.6) !important;
    }
    
    & .MuiSelect-root {
        color: #ffffff !important;
    }
    
    & .MuiMenuItem-root {
        color: #ffffff !important;
        background-color: rgba(40, 40, 40, 0.9) !important;
        
        &:hover {
            background-color: rgba(60, 60, 60, 0.9) !important;
        }
    }
    
    & .MuiButton-root {
        color: #ffffff !important;
        border-color: rgba(255, 255, 255, 0.3) !important;
        
        &.MuiButton-contained {
            background-color: #64b5f6 !important;
            color: #ffffff !important;
            
            &:hover {
                background-color: #42a5f5 !important;
            }
        }
        
        &.MuiButton-outlined:hover {
            border-color: rgba(255, 255, 255, 0.5) !important;
            background-color: rgba(255, 255, 255, 0.1) !important;
        }
    }
    
    & .MuiDivider-root {
        border-color: rgba(255, 255, 255, 0.2) !important;
    }
`;
type Props = {
    eventId: TEventId;
};

export const EventPassages = ({ eventId }: Props) => {
    const store = useVisualizerStore();

    // Get all available events from register
    const events = Object.entries(register.events).map(([id, event]) => ({
        id: id as TEventId,
        title: event.title,
    }));

    const handlePassageCreated = (passageId: string) => {
        // Handle passage creation - you might want to refresh the graph or perform other actions
        console.log('Passage created:', passageId);
    };

    return (
        <WholeContainer>
            <Nav>
                <SRow>
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
                                events.find((event) => event.id === eventId) ??
                                null
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
                            getOptionLabel={(option) =>
                                option.title || option.id
                            }
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
                </SRow>
            </Nav>
            
            <SContentArea>
                <ResizableSplitter
                    leftContent={<EventPassagesGraph eventId={eventId} />}
                    rightContent={
                        <SFormContainer>
                            <DarkThemedForm>
                                <ScreenPassageCreationForm
                                    eventId={eventId}
                                    agent={store.agent}
                                    onPassageCreated={handlePassageCreated}
                                />
                            </DarkThemedForm>
                        </SFormContainer>
                    }
                    initialLeftWidth={75}
                    minLeftWidth={30}
                    maxLeftWidth={85}
                />
            </SContentArea>
        </WholeContainer>
    );
};

const SRow = styled(Row)`
    gap: ${spacingCss(2)};
`;

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

const SContentArea = styled('div')`
    flex: 1;
    overflow: hidden;
    border-top: 1px solid grey;
    border-bottom: 1px solid grey;
`;

const SFormContainer = styled('div')`
    height: 100%;
    overflow-y: auto;
    padding: ${spacingCss(2)};
    background-color: transparent;
    
    /* Custom scrollbar for dark theme */
    &::-webkit-scrollbar {
        width: 8px;
    }
    
    &::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
    }
    
    &::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        
        &:hover {
            background: rgba(255, 255, 255, 0.5);
        }
    }
`;