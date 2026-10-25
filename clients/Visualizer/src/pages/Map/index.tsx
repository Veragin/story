import { useEffect, useState } from 'react';
import { api, apiEvents } from '../../api';
import { modals, PageContainer } from '../../shell';
import { MapPageStore } from './MapPageStore';
import { MapPageContent } from './MapPageContent';
import { askDeleteLocation } from './mapDialogs';

export const MapPage = ({ mapId }: { mapId?: string }) => {
    const [store, setStore] = useState<MapPageStore | null>(null);

    useEffect(() => {
        const s = new MapPageStore({
            api,
            events: apiEvents,
            mapId,
            confirm: modals.confirm,
            askDelete: askDeleteLocation,
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
    }, [mapId]);

    return (
        <PageContainer>
            {store && <MapPageContent store={store} />}
        </PageContainer>
    );
};
