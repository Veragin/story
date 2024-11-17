import { ReactNode, useState } from 'react';
import { visualizerStoreContext } from '../Context';
import { TimeManager } from 'time/TimeManager';
import { Store } from './ts/Store';
import { InfoModal } from './components/InfoModal';

type Props = {
    children: ReactNode;
};

export const Wrapper = ({ children }: Props) => {
    const [store] = useState(new Store(new TimeManager()));
    return (
        <visualizerStoreContext.Provider value={store}>
            {children}
            <InfoModal />
        </visualizerStoreContext.Provider>
    );
};
