import { ReactNode } from 'react';
import { StrictMode } from 'react';
import '../index.css';
import { EnqueueSnackbar, SnackbarProvider, useSnackbar } from 'notistack';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import appTheme from 'code/theme/theme';
import { applyFormatting } from '../utils/translations';

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

applyFormatting('we have to load _ finction', []);

const ToastWrapper = () => {
    const { enqueueSnackbar } = useSnackbar();
    latestSnack = enqueueSnackbar;
    return null;
};
let latestSnack: EnqueueSnackbar = () => '0';
export const showToast = (...data: Parameters<EnqueueSnackbar>) =>
    latestSnack(...data);
