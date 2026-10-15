import { ReactNode } from 'react';
import { worldStateContext, engineContext, storeContext } from './context';
import type { Engine } from '@story/core';
import type { TWorldState } from '@story/data';

type Props = {
    s: TWorldState;
    e: Engine;
    children: ReactNode;
};

export const Wrapper = ({ s, e, children }: Props) => {
    return (
        <worldStateContext.Provider value={s}>
            <engineContext.Provider value={e}>
                <storeContext.Provider value={e.store}>
                    {children}
                </storeContext.Provider>
            </engineContext.Provider>
        </worldStateContext.Provider>
    );
};
