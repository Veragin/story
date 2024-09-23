import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { worldStateContext, engineContext, storeContext } from './code/Context';
import { App } from './App';
import { e, s } from 'worldState';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <worldStateContext.Provider value={s}>
            <engineContext.Provider value={e}>
                <storeContext.Provider value={e.store}>
                    <App />
                </storeContext.Provider>
            </engineContext.Provider>
        </worldStateContext.Provider>
    </StrictMode>
);
