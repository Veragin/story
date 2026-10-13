import { ReactNode, useState } from 'react';
import { TimeManager } from '@story/shared';
import { visualizerStoreContext, type TVisualizerStore } from './context';

type Props = {
    children: ReactNode;
};

export const Wrapper = ({ children }: Props) => {
    const [store] = useState<TVisualizerStore>(() => ({
        timeManager: new TimeManager(),
    }));
    return (
        <visualizerStoreContext.Provider value={store}>
            {children}
        </visualizerStoreContext.Provider>
    );
};
