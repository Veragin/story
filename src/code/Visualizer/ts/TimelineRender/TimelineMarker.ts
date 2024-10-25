import { Time } from 'time/Time';
import { TimeManager } from 'time/TimeManager';

export const MARKER_TIME_CLASS = 'timeline-marker-time';
export const MARKER_LINE_CLASS = 'timeline-marker-line';

export class TimelineMarker {
    private timeRef = document.createElement('div');

    constructor(
        private markerRef: HTMLDivElement,
        private timeManager: TimeManager
    ) {
        this.timeRef.classList.add(MARKER_TIME_CLASS);
        markerRef.appendChild(this.timeRef);

        const line = document.createElement('div');
        line.classList.add(MARKER_LINE_CLASS);
        markerRef.appendChild(line);
    }

    update = (x: number, time: Time) => {
        this.markerRef.style.left = `${x}px`;
        this.timeRef.innerText = this.timeManager.renderTime(time, 'dateTime');
    };

    hide = () => {
        this.markerRef.style.display = 'none';
    };

    show = () => {
        this.markerRef.style.display = 'flex';
    };

    destructor = () => {
        this.markerRef.innerHTML = '';
    };
}
