import { ReactNode } from 'react';
import { StrictMode } from 'react';
import './index.css';
import { worldStateContext, engineContext, storeContext } from './Context';
import { e, s } from 'worldState';
import { EnqueueSnackbar, SnackbarProvider, useSnackbar } from 'notistack';
import { applyFormatting } from './utils/translations';

type Props = {
    children: ReactNode;
};

export const Wrapper = ({ children }: Props) => {
    return (
        <StrictMode>
            <worldStateContext.Provider value={s}>
                <engineContext.Provider value={e}>
                    <storeContext.Provider value={e.store}>
                        <SnackbarProvider maxSnack={3}>
                            <ToastWrapper />
                            {children}
                        </SnackbarProvider>
                    </storeContext.Provider>
                </engineContext.Provider>
            </worldStateContext.Provider>
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
