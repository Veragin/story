import { ReactNode } from 'react';
import { StrictMode } from 'react';
import './index.css';
import { EnqueueSnackbar, SnackbarProvider, useSnackbar } from 'notistack';
import { applyFormatting } from './utils/translations';

type Props = {
    children: ReactNode;
};

export const GlobalWrapper = ({ children }: Props) => {
    return (
        <StrictMode>
            <SnackbarProvider maxSnack={3}>
                <ToastWrapper />
                {children}
            </SnackbarProvider>
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
