import { alpha, createTheme, type ThemeOptions } from '@mui/material';

const FORM = {
    text: '#ffffff',
    label: 'rgba(255, 255, 255, 0.75)',
    border: 'rgba(255, 255, 255, 0.5)',
    borderHover: '#ffffff',
    borderDisabled: 'rgba(255, 255, 255, 0.2)',
    accent: '#66bb6a',
};

const formComponents: ThemeOptions['components'] = {
    MuiToggleButton: {
        styleOverrides: {
            root: {
                'color': FORM.text,
                'borderColor': FORM.border,
                '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.08)' },
                '&.Mui-selected, &.Mui-selected:hover': {
                    color: FORM.accent,
                    borderColor: FORM.accent,
                    backgroundColor: alpha(FORM.accent, 0.16),
                },
                '&.Mui-disabled': {
                    color: 'rgba(255, 255, 255, 0.3)',
                    borderColor: FORM.borderDisabled,
                },
            },
        },
    },
    MuiToggleButtonGroup: {
        styleOverrides: {
            // MUI blanks the left border of later grouped buttons
            grouped: { '&.Mui-selected': { borderLeftColor: FORM.accent } },
        },
    },
    MuiOutlinedInput: {
        styleOverrides: {
            root: {
                'color': FORM.text,
                '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: FORM.border,
                },
                '&:hover:not(.Mui-disabled, .Mui-error, .Mui-focused) .MuiOutlinedInput-notchedOutline': {
                    borderColor: FORM.borderHover,
                },
                '&.Mui-focused:not(.Mui-error) .MuiOutlinedInput-notchedOutline': { borderColor: FORM.accent },
                '&.Mui-error .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#f44336',
                },
                '&.Mui-disabled .MuiOutlinedInput-notchedOutline': {
                    borderColor: FORM.borderDisabled,
                },
            },
        },
    },
    MuiInputLabel: {
        styleOverrides: {
            root: {
                'color': FORM.label,
                '&.Mui-focused:not(.Mui-error)': { color: FORM.accent },
            },
        },
    },
    MuiSelect: {
        styleOverrides: {
            icon: { color: FORM.label },
        },
    },
};

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
        ...formComponents,
        MuiTextField: {
            styleOverrides: {
                root: {
                    '& .MuiOutlinedInput-root': {
                        backgroundColor: 'rgba(50, 50, 50, 0.8)',
                    },
                    '& .MuiFormHelperText-root': {
                        color: 'rgba(255, 255, 255, 0.6)',
                    },
                },
            },
        },
        MuiSelect: {
            styleOverrides: {
                ...formComponents.MuiSelect?.styleOverrides,
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
