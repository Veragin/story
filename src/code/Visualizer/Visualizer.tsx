import { Events } from './Events/Events';
import { EventPassages } from './Events/EventPassages';
import { useVisualizerStore } from 'code/Context';
import { observer } from 'mobx-react-lite';
import { MapWrapper } from './MapEditor/MapWrapper';

export const Visualizer = observer(() => {
    const store = useVisualizerStore();

    if (store.activeTab === null) {
        return <Events />;
    }

    if (store.activeTab.tab === 'event') {
        return <EventPassages eventId={store.activeTab.eventId} />;
    }

    if (store.activeTab.tab === 'map') {
        return <MapWrapper mapId={store.activeTab.mapId} />;
    }

    return null;
});