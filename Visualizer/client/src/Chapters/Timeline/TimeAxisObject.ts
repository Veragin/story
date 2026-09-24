import { SceneObject, type TDrawSpec, type TSceneObjectOptions, type Viewport } from '@story/canvas';
import { DAY_S, HOUR_S, MIN_S, MONTH_S, Time, YEAR_S, type TBBox, type TimeManager } from '@story/shared';

/**
 * The timeline's ruler: tick marks and time labels across the bottom of the view
 * (VISUALIZER_PLAN §7, Phase 8).
 *
 * ## Why this reads the viewport
 *
 * Every other `SceneObject` describes a fixed shape in world coordinates. An axis cannot: which
 * ticks exist, and how they are labelled, is a function of *how much time is on screen*. So this
 * one holds a reference to the `Viewport` and recomputes on each `toSpec`.
 *
 * That does not break design rule 1 — everything it emits is still world coordinates — and it is
 * client code, not library code, which is the right side of the line: `@story/canvas` has no
 * business knowing what a month is.
 *
 * ## The tick interval is chosen, not configured
 *
 * The timeline it replaces had a five-entry `ZOOM_CONFIG` table pairing a fixed visible duration
 * with a fixed label interval, so zoom was five discrete steps and nothing in between. Here the
 * interval is picked from the *current* scale: the smallest "round" duration — a minute, an
 * hour, a day, a month, a year — that keeps labels at least `MIN_LABEL_SPACING_PX` apart. Zoom
 * is continuous and the labels stay readable at every point of it.
 */

/** Candidate tick intervals, in seconds, smallest first. Each is a duration a person names. */
const NICE_INTERVALS = [
    MIN_S,
    5 * MIN_S,
    15 * MIN_S,
    30 * MIN_S,
    HOUR_S,
    2 * HOUR_S,
    6 * HOUR_S,
    12 * HOUR_S,
    DAY_S,
    2 * DAY_S,
    5 * DAY_S,
    10 * DAY_S,
    MONTH_S,
    2 * MONTH_S,
    3 * MONTH_S,
    6 * MONTH_S,
    YEAR_S,
    2 * YEAR_S,
    5 * YEAR_S,
    10 * YEAR_S,
];

const MIN_LABEL_SPACING_PX = 140;
const AXIS_COLOR = '#61666f';
const LABEL_COLOR = '#c8cdd6';

export type TTimeAxisOptions = TSceneObjectOptions & {
    viewport: Viewport;
    timeManager: TimeManager;
    /** World y of the axis line. The rows sit above it. */
    y: number;
};

export class TimeAxisObject extends SceneObject {
    readonly type = 'time-axis';

    private readonly viewport: Viewport;
    private readonly timeManager: TimeManager;
    private axisY: number;

    constructor(options: TTimeAxisOptions) {
        super({ layer: 'background', selectable: false, draggable: false, ...options });
        this.viewport = options.viewport;
        this.timeManager = options.timeManager;
        this.axisY = options.y;
    }

    setY(y: number): void {
        if (y === this.axisY) return;
        this.axisY = y;
        this.notify('y');
    }

    /** Spans the visible range, so culling never hides the axis. */
    get bounds(): TBBox {
        const visible = this.viewport.visibleBounds;
        return { min: { x: visible.min.x, y: this.axisY - 1 }, max: { x: visible.max.x, y: this.axisY + 1 } };
    }

    /** The axis is scenery: clicks pass through it to whatever is behind. */
    hitTest(): boolean {
        return false;
    }

    translate(): void {
        /* the axis is pinned to the view, not draggable */
    }

    toSpec(): TDrawSpec {
        const visible = this.viewport.visibleBounds;
        const secondsPerPixel = this.viewport.pixelSize.width;
        const interval = chooseInterval(secondsPerPixel);
        const format = formatFor(interval);

        const children: TDrawSpec[] = [
            {
                kind: 'line',
                points: [visible.min.x, this.axisY, visible.max.x, this.axisY],
                stroke: AXIS_COLOR,
                strokeWidth: 2,
                strokeScaleEnabled: false,
            },
        ];

        // Start at the first tick at or after the left edge. Clamped at zero: the story's epoch
        // is time 0 and there is nothing before it to label.
        const first = Math.ceil(Math.max(0, visible.min.x) / interval) * interval;
        // A hard cap rather than trusting the interval choice: a viewport in a transient state
        // (mid-resize, before the first layout) can report a nonsense range, and drawing a
        // million ticks is the difference between a glitch and a hung tab.
        const maxTicks = 200;

        for (let i = 0, tick = first; tick <= visible.max.x && i < maxTicks; i++, tick += interval) {
            children.push({
                kind: 'line',
                points: [tick, this.axisY - 8 * this.viewport.pixelSize.height, tick, this.axisY],
                stroke: AXIS_COLOR,
                strokeWidth: 1,
                strokeScaleEnabled: false,
            });

            children.push({
                kind: 'text',
                // Below the line, nudged by a few screen pixels converted into world units so
                // the gap does not change with zoom.
                position: { x: tick, y: this.axisY + 14 * this.viewport.pixelSize.height },
                text: this.timeManager.renderTime(Time.fromS(tick), format),
                fontSize: 11,
                fill: LABEL_COLOR,
                centered: true,
            });
        }

        return { kind: 'group', children };
    }
}

/** The smallest round interval whose ticks are at least `MIN_LABEL_SPACING_PX` apart. */
const chooseInterval = (secondsPerPixel: number): number => {
    const wanted = Math.max(1, secondsPerPixel * MIN_LABEL_SPACING_PX);
    return NICE_INTERVALS.find((candidate) => candidate >= wanted) ?? NICE_INTERVALS[NICE_INTERVALS.length - 1];
};

/**
 * How much of a timestamp to show, given how far apart the ticks are.
 *
 * Showing the time of day on a year-wide view is noise; showing only the month on a day-wide
 * view makes every label identical. The threshold is the interval itself, which is the only
 * thing that actually determines whether neighbouring labels would differ.
 */
const formatFor = (interval: number): 'month' | 'date' | 'dateTime' => {
    if (interval >= MONTH_S) return 'month';
    if (interval >= DAY_S) return 'date';
    return 'dateTime';
};
