import { EventTimeline } from './EventTimeline';
import { EventPassages } from './EventPassages';
import { useVisualizerStore } from 'code/Context';
import { observer } from 'mobx-react-lite';

export const Visualizer = observer(() => {
    const store = useVisualizerStore();

    if (store.activeEvent === null) {
        return <EventTimeline />;
    }

    return <EventPassages />;
});
