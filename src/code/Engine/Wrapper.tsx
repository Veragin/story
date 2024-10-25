import { ReactNode } from 'react';
import { worldStateContext, engineContext, storeContext } from '../Context';
import { e, s } from 'worldState';
import { applyFormatting } from '../utils/translations';

type Props = {
    children: ReactNode;
};

export const Wrapper = ({ children }: Props) => {
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

applyFormatting('we have to load _ finction', []);
