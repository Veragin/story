import { ReactNode, useState } from 'react';
import { visualizerStoreContext } from '../Context';
import { Store } from './ts/Store';
import { TimeManager } from 'time/TimeManager';

type Props = {
    children: ReactNode;
};

export const Wrapper = ({ children }: Props) => {
    const [store] = useState(new Store(new TimeManager()));
    return (
        <visualizerStoreContext.Provider value={store}>
            {children}
        </visualizerStoreContext.Provider>
    );
};
