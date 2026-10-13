import { useEffect, useState } from 'react';
import { api, apiEvents } from '../../api';
import { modals, PageContainer } from '../../shell';
import { MapPageStore } from './MapPageStore';
import { MapPageContent } from './MapPageContent';

export const MapPage = () => {
    const [store, setStore] = useState<MapPageStore | null>(null);

    useEffect(() => {
        const s = new MapPageStore({
            api,
            events: apiEvents,
            confirm: modals.confirm,
        });
        setStore(s);
        void s.init();
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            if (!s.hasUnsavedChanges) return;
            void s.flush();
            e.preventDefault();
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', onBeforeUnload);
            s.destroy();
        };
    }, []);

    return (
        <PageContainer>
            {store && <MapPageContent store={store} />}
        </PageContainer>
    );
};
