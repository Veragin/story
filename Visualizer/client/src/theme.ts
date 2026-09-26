import { createTheme } from '@mui/material';

/**
 * Dark MUI theme for the Visualizer's forms and side panels (was duplicated in
 * `Chapters.tsx` and `ChapterPassages.tsx`). The app-wide theme is `appTheme` from `@story/ui`;
 * wrap form areas in `<ThemeProvider theme={darkTheme}>`.
 */
export const darkTheme = createTheme({
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
                        'backgroundColor': 'rgba(50, 50, 50, 0.8)',
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
                        'color': 'rgba(255, 255, 255, 0.7)',
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
                    'backgroundColor': '#2a2a2a',
                    'color': '#ffffff',
                    '&:hover': {
                        backgroundColor: '#3a3a3a',
                    },
                    '&.Mui-selected': {
                        'backgroundColor': '#4a4a4a',
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
                    'borderColor': 'rgba(255, 255, 255, 0.3)',
                    'color': '#ffffff',
                    '&:hover': {
                        borderColor: 'rgba(255, 255, 255, 0.5)',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    },
                },
                contained: {
                    'backgroundColor': '#64b5f6',
                    'color': '#ffffff',
                    '&:hover': {
                        backgroundColor: '#42a5f5',
                    },
                },
            },
        },
        MuiAccordion: {
            styleOverrides: {
                root: {
                    'backgroundColor': 'transparent',
                    '&:before': {
                        display: 'none',
                    },
                },
            },
        },
        MuiAccordionSummary: {
            styleOverrides: {
                root: {
                    'backgroundColor': 'rgba(50, 50, 50, 0.5)',
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
                    'backgroundColor': 'rgba(40, 40, 40, 0.3)',
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
