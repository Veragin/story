import { createTheme, type ThemeOptions } from '@mui/material';
import type { CSSProperties } from 'react';

type TSurfacePalette = {
    code: string;
    overlay: string;
};

type TBorderPalette = {
    subtle: string;
    strong: string;
};

declare module '@mui/material/styles' {
    interface Palette {
        surface: TSurfacePalette;
        border: TBorderPalette;
    }
    interface PaletteOptions {
        surface?: TSurfacePalette;
        border?: TBorderPalette;
    }
    interface TypeText {
        code: string;
    }
    interface TypographyVariants {
        meta: CSSProperties;
        small: CSSProperties;
    }
    interface TypographyVariantsOptions {
        meta?: CSSProperties;
        small?: CSSProperties;
    }
}

declare module '@mui/material/Typography' {
    interface TypographyPropsVariantOverrides {
        meta: true;
        small: true;
    }
}

const SURFACE: TSurfacePalette = {
    code: '#111',
    overlay: 'rgba(17, 17, 17, 0.92)',
};

const BORDER: TBorderPalette = {
    subtle: 'rgba(255, 255, 255, 0.12)',
    strong: 'rgba(255, 255, 255, 0.25)',
};

const FORM = {
    text: '#ffffff',
    label: 'rgba(255, 255, 255, 0.75)',
    border: 'rgba(255, 255, 255, 0.5)',
    borderHover: '#ffffff',
    borderDisabled: 'rgba(255, 255, 255, 0.2)',
    accent: '#66bb6a',
};

const TOGGLE = {
    text: 'rgba(255, 255, 255, 0.7)',
    track: 'rgba(255, 255, 255, 0.05)',
    hover: 'rgba(255, 255, 255, 0.08)',
    selected: '#2e7d32',
    selectedHover: '#388e3c',
};

const formComponents: ThemeOptions['components'] = {
    MuiToggleButton: {
        styleOverrides: {
            root: {
                'gap': 4,
                'padding': '4px 12px',
                'border': `1px solid ${BORDER.subtle}`,
                'borderRadius': 8,
                'color': TOGGLE.text,
                'textTransform': 'none',
                'transition': 'background-color 120ms, color 120ms',
                '&:hover': {
                    color: FORM.text,
                    backgroundColor: TOGGLE.hover,
                },
                '&.Mui-selected': {
                    'color': FORM.text,
                    'backgroundColor': TOGGLE.selected,
                    '&:hover': { backgroundColor: TOGGLE.selectedHover },
                },
                '&.Mui-focusVisible': {
                    outline: `2px solid ${FORM.accent}`,
                    outlineOffset: 1,
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
            root: {
                gap: 2,
                padding: 2,
                borderRadius: 10,
                border: `1px solid ${BORDER.subtle}`,
                backgroundColor: TOGGLE.track,
            },
            grouped: {
                // outranks MUI's first/middle/last button radius and border resets
                '&.MuiToggleButton-root': {
                    margin: 0,
                    border: 0,
                    borderRadius: 7,
                },
            },
        },
    },
    MuiOutlinedInput: {
        styleOverrides: {
            root: ({ theme }) => ({
                'color': FORM.text,
                '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: FORM.border,
                },
                '&:hover:not(.Mui-disabled, .Mui-error, .Mui-focused) .MuiOutlinedInput-notchedOutline': {
                    borderColor: FORM.borderHover,
                },
                '&.Mui-focused:not(.Mui-error) .MuiOutlinedInput-notchedOutline': { borderColor: FORM.accent },
                '&.Mui-error .MuiOutlinedInput-notchedOutline': {
                    borderColor: theme.palette.error.main,
                },
                '&.Mui-disabled .MuiOutlinedInput-notchedOutline': {
                    borderColor: FORM.borderDisabled,
                },
            }),
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
            root: { color: FORM.text },
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
            code: '#e6db74',
        },
        surface: SURFACE,
        border: BORDER,
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
    typography: {
        meta: { fontSize: '12px' },
        small: { fontSize: '13px' },
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
