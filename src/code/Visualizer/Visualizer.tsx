import { useState } from 'react';
import { EventTimeline } from './EventTimeline';
import { EventPassages } from './EventPassages';

type TService = 'event-timeline' | 'event-passages';

export const Visualizer = () => {
    const [service] = useState<TService>('event-timeline');

    if (service === 'event-passages') {
        return <EventPassages />;
    }

    return <EventTimeline />;
};
