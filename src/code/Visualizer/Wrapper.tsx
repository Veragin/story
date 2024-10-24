import { ReactNode, useState } from 'react';
import './index.css';
import { visualizerStoreContext } from '../Context';
import { Store } from './ts/Store';

type Props = {
    children: ReactNode;
};

export const Wrapper = ({ children }: Props) => {
    const [store] = useState(new Store());
    return (
        <visualizerStoreContext.Provider value={store}>
            {children}
        </visualizerStoreContext.Provider>
    );
};
