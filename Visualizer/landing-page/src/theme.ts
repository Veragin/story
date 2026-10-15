import { createTheme } from '@mui/material';

export const darkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#64b5f6' },
        background: { default: '#1a1a1a', paper: '#2a2a2a' },
        text: { primary: '#ffffff', secondary: 'rgba(255, 255, 255, 0.7)' },
        divider: 'rgba(255, 255, 255, 0.2)',
    },
    components: {
        MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    },
});
