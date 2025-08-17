import React from 'react';
import {
    styled,
    FormControl,
    Autocomplete,
    TextField,
    Button,
    ThemeProvider,
    createTheme,
} from '@mui/material';
import { Column, Row, WholeContainer } from 'code/components/Basic';
import { spacingCss } from 'code/components/css';
import { useVisualizerStore } from 'code/Context';
import { register } from 'data/register';
import { Nav } from '../components/Nav';
import { TChapterId } from 'types/TIds';
import { ResizableSplitter } from '../Passages/ResizableSplitter';
import { ChapterPassagesGraph } from '../Passages/ChapterPassagesGraph';
import { ScreenPassageCreationForm } from '../Passages/ScreenPassageCreationForm/ScreenPassageCreationForm';

// Create a dark theme for the form
const darkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main: '#64b5f6',
        },
        background: {
            default: '#1a1a1a',
            paper: '#2a2a2a',
        },
        text: {
            primary: '#ffffff',
            secondary: 'rgba(255, 255, 255, 0.7)',
        },
        divider: 'rgba(255, 255, 255, 0.2)',
        grey: {
            50: '#fafafa',
            100: '#f5f5f5',
            200: '#eeeeee',
            300: '#e0e0e0',
            400: '#bdbdbd',
            500: '#9e9e9e',
            600: '#757575',
            700: '#616161',
            800: '#424242',
            900: '#212121',
        },
    },
    components: {
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                },
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        backgroundColor: 'rgba(50, 50, 50, 0.8)',
                        '& fieldset': {
                            borderColor: 'rgba(255, 255, 255, 0.3)',
                        },
                        '&:hover fieldset': {
                            borderColor: 'rgba(255, 255, 255, 0.5)',
                        },
                        '&.Mui-focused fieldset': {
                            borderColor: '#64b5f6',
                        },
                    },
                    '& .MuiInputLabel-root': {
                        color: 'rgba(255, 255, 255, 0.7)',
                        '&.Mui-focused': {
                            color: '#64b5f6',
                        },
                    },
                    '& .MuiFormHelperText-root': {
                        color: 'rgba(255, 255, 255, 0.6)',
                    },
                },
            },
        },
        MuiSelect: {
            styleOverrides: {
                root: {
                    color: '#ffffff',
                },
            },
        },
        MuiMenuItem: {
            styleOverrides: {
                root: {
                    backgroundColor: '#2a2a2a',
                    color: '#ffffff',
                    '&:hover': {
                        backgroundColor: '#3a3a3a',
                    },
                    '&.Mui-selected': {
                        backgroundColor: '#4a4a4a',
                        '&:hover': {
                            backgroundColor: '#5a5a5a',
                        },
                    },
                },
            },
        },
        MuiButton: {
            styleOverrides: {
                outlined: {
                    borderColor: 'rgba(255, 255, 255, 0.3)',
                    color: '#ffffff',
                    '&:hover': {
                        borderColor: 'rgba(255, 255, 255, 0.5)',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    },
                },
                contained: {
                    backgroundColor: '#64b5f6',
                    color: '#ffffff',
                    '&:hover': {
                        backgroundColor: '#42a5f5',
                    },
                },
            },
        },
        MuiAccordion: {
            styleOverrides: {
                root: {
                    backgroundColor: 'transparent',
                    '&:before': {
                        display: 'none',
                    },
                },
            },
        },
        MuiAccordionSummary: {
            styleOverrides: {
                root: {
                    backgroundColor: 'rgba(50, 50, 50, 0.5)',
                    '&:hover': {
                        backgroundColor: 'rgba(60, 60, 60, 0.5)',
                    },
                },
            },
        },
        MuiAccordionDetails: {
            styleOverrides: {
                root: {
                    backgroundColor: 'rgba(40, 40, 40, 0.5)',
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    backgroundColor: '#2a2a2a',
                },
            },
        },
        MuiCardHeader: {
            styleOverrides: {
                root: {
                    backgroundColor: 'rgba(50, 50, 50, 0.5)',
                },
                title: {
                    color: '#ffffff',
                    fontSize: '0.875rem',
                },
                subheader: {
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '0.75rem',
                },
            },
        },
        MuiCardContent: {
            styleOverrides: {
                root: {
                    backgroundColor: 'rgba(40, 40, 40, 0.3)',
                    '&:last-child': {
                        paddingBottom: '12px',
                    },
                },
            },
        },
        MuiCollapse: {
            styleOverrides: {
                wrapperInner: {
                    backgroundColor: 'transparent',
                },
            },
        },
    },
});

type Props = {
    chapterId: TChapterId;
};

export const ChapterPassages = ({ chapterId }: Props) => {
    const store = useVisualizerStore();

    // Get all available chapters from register
    const chapters = Object.entries(register.chapters).map(([id, chapter]) => ({
        id: id as TChapterId,
        title: chapter.title,
    }));

    const handlePassageCreated = (passageId: string) => {
        // Handle passage creation - you might want to refresh the graph or perform other actions
        console.log('Passage created:', passageId);
        // You could trigger a refresh of the ChapterPassagesGraph here if needed
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
                                chapters.find((chapter) => chapter.id === chapterId) ??
                                null
                            }
                            onChange={(_, newValue) => {
                                store.setActiveTab(
                                    newValue === null
                                        ? null
                                        : {
                                              tab: 'chapter',
                                              chapterId: newValue.id,
                                          }
                                );
                            }}
                            options={chapters}
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
                    leftContent={<ChapterPassagesGraph chapterId={chapterId} />}
                    rightContent={
                        <SFormContainer>
                            <ThemeProvider theme={darkTheme}>
                                <ScreenPassageCreationForm
                                    chapterId={chapterId}
                                    agent={store.agent}
                                    onPassageCreated={handlePassageCreated}
                                />
                            </ThemeProvider>
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
    margin: 0;

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
                top: 50%;
                transform: translateY(-50%);
            }
        }
    }

    & .MuiInputLabel-root {
        color: white;
        background-color: black;
        border-radius: 4px;
        padding: 0 ${spacingCss(0.5)};
        transform: translate(14px, -6px) scale(0.75);

        &.Mui-focused {
            color: white;
        }
    }

    & .MuiOutlinedInput-notchedOutline {
        border-color: rgba(0, 0, 0, 0.23);
    }

    & .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline {
        border-color: rgba(0, 0, 0, 0.87);
    }

    & .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline {
        border-color: black;
    }

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
    padding: ${spacingCss(1.5)};
    background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
    
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
    
    /* Ensure form fits well */
    & > * {
        max-width: 100%;
    }
`;