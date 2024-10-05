import { ReactNode } from 'react';
import { StrictMode } from 'react';
import './index.css';
import { worldStateContext, engineContext, storeContext } from './Context';
import { e, s } from 'worldState';

type Props = {
    children: ReactNode;
};

export const Wrapper = ({ children }: Props) => {
    return (
        <StrictMode>
            <worldStateContext.Provider value={s}>
                <engineContext.Provider value={e}>
                    <storeContext.Provider value={e.store}>
                        {children}
                    </storeContext.Provider>
                </engineContext.Provider>
            </worldStateContext.Provider>
        </StrictMode>
    );
};
