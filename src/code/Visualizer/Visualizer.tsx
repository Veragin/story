import { EventTimeline } from './Events/EventTimeline';
import { EventPassages } from './Events/EventPassages';
import { useVisualizerStore } from 'code/Context';
import { observer } from 'mobx-react-lite';

export const Visualizer = observer(() => {
    const store = useVisualizerStore();

    if (store.activeTab === null) {
        return <EventTimeline />;
    }

    if (store.activeTab.tab === 'event') {
        return <EventPassages eventId={store.activeTab.eventId} />;
    }

    if (store.activeTab.tab === 'map') {
        return <EventPassages eventId={store.activeTab.mapId} />;
    }

    return null;
});
