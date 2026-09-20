import { ReactNode, StrictMode } from 'react';
import { SnackbarProvider, useSnackbar } from 'notistack';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import appTheme from './theme';
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

// Importing `applyFormatting` is what evaluates `../translations`, which installs the
// global `_` (declared in `../translations.d.ts`). The call keeps the import from being
// elided as type-only.
applyFormatting('we have to load _ finction', []);

// Wrapped rather than passed straight through: `setToastHandler` takes the framework-agnostic
// `TToastHandler` from `@story/shared` (plain string + variant), not notistack's overloaded
// `EnqueueSnackbar`. This is the single place the two meet.
const ToastWrapper = () => {
    const { enqueueSnackbar } = useSnackbar();
    setToastHandler((message, options) => enqueueSnackbar(message, options));
    return null;
};
