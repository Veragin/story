import { ReactNode, StrictMode } from 'react';
import { SnackbarProvider, useSnackbar } from 'notistack';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { appTheme } from './theme';
import { applyFormatting } from '../translations';
import { setToastHandler } from '../toast';

type Props = {
    children: ReactNode;
};

export const GlobalThemeWrapper = ({ children }: Props) => {
    return (
        <StrictMode>
            <ThemeProvider theme={appTheme}>
                <CssBaseline />
                <SnackbarProvider maxSnack={3}>
                    <ToastWrapper />
                    {children}
                </SnackbarProvider>
            </ThemeProvider>
        </StrictMode>
    );
};

// keeps the import that installs the global `_` from being elided
applyFormatting('we have to load _ finction', []);

const ToastWrapper = () => {
    const { enqueueSnackbar } = useSnackbar();
    setToastHandler((message, options) => enqueueSnackbar(message, options));
    return null;
};
