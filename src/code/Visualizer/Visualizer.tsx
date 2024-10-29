import { useState } from 'react';
import { EventTimeline } from './EventTimeline';
import { EventPassages } from './EventPassages';

type TService = 'event-timeline' | 'event-passages';

export const Visualizer = () => {
    const [service] = useState<TService>('event-passages');

    if (service === 'event-passages') {
        return <EventPassages />;
    }

    return <EventTimeline />;
};
