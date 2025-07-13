import React from 'react';
import {
    styled,
    Button,
    ThemeProvider,
    createTheme,
    Typography,
} from '@mui/material';
import { Column, Row, WholeContainer } from 'code/components/Basic';
import { spacingCss } from 'code/components/css';
import { useVisualizerStore } from 'code/Context';
import { Nav } from '../components/Nav';
import { ResizableSplitter } from '../Passages/ResizableSplitter';
import { EventTimeline } from './EventTimeline';
import { EventCreationForm } from './EventCreationForm/EventCreationForm';
import { Add, Event } from '@mui/icons-material';

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

export const Events = () => {
    const store = useVisualizerStore();

    const handleEventCreated = (eventId: string) => {
        // Handle event creation - navigate to the new event's passages
        console.log('Event created:', eventId);
        store.setActiveTab({
            tab: 'event',
            eventId: eventId as any, // Cast to match TEventId type
        });
    };

    return (
        <WholeContainer>
            <Nav>
                <SRow>
                    <SNavTitle>
                        <Event fontSize="small" sx={{ mr: 1 }} />
                        <Typography variant="h6" component="span" sx={{ fontSize: '1rem', fontWeight: 500 }}>
                            {_('Events Manager')}
                        </Typography>
                    </SNavTitle>
                    <SNavActions>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                            {_('Create and manage game events')}
                        </Typography>
                    </SNavActions>
                </SRow>
            </Nav>
            
            <SContentArea>
                <ResizableSplitter
                    leftContent={
                        <STimelineContainer>
                            <EventTimeline />
                        </STimelineContainer>
                    }
                    rightContent={
                        <SFormContainer>
                            <ThemeProvider theme={darkTheme}>
                                <EventCreationForm
                                    agent={store.agent}
                                    onEventCreated={handleEventCreated}
                                />
                            </ThemeProvider>
                        </SFormContainer>
                    }
                    initialLeftWidth={65}
                    minLeftWidth={30}
                    maxLeftWidth={80}
                />
            </SContentArea>
        </WholeContainer>
    );
};

const SRow = styled(Row)`
    gap: ${spacingCss(2)};
    width: 100%;
    justify-content: space-between;
    align-items: center;
`;

const SNavTitle = styled('div')`
    display: flex;
    align-items: center;
    color: white;
`;

const SNavActions = styled('div')`
    display: flex;
    align-items: center;
    gap: ${spacingCss(1)};
`;

const SContentArea = styled('div')`
    flex: 1;
    overflow: hidden;
    border-top: 1px solid grey;
    border-bottom: 1px solid grey;
`;

const STimelineContainer = styled('div')`
    height: 100%;
    width: 100%;
    overflow: hidden;
    background-color: ${({ theme }) => theme?.palette?.background?.default || '#fafafa'};
    
    /* Ensure timeline fits well */
    & > * {
        height: 100%;
        width: 100%;
    }
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