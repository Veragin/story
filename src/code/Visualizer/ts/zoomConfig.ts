import { DAY_S, HOUR_S, MONTH_S, YEAR_S } from 'time/const';
import { DeltaTime } from 'time/Time';
import { TTimeRenderFormat } from 'time/TimeManager';

export const ZOOM_CONFIG: TZoomConfigItem[] = [
    {
        displayTime: DeltaTime.fromS(YEAR_S),
        labels: {
            distance: DeltaTime.fromS(2 * MONTH_S),
            timeRoundTo: DeltaTime.fromS(MONTH_S),
        },
        renderedTimeFormat: 'month',
    },
    {
        displayTime: DeltaTime.fromS(YEAR_S / 2),
        labels: {
            distance: DeltaTime.fromS(MONTH_S),
            timeRoundTo: DeltaTime.fromS(MONTH_S),
        },
        renderedTimeFormat: 'month',
    },
    {
        displayTime: DeltaTime.fromS(MONTH_S),
        labels: {
            distance: DeltaTime.fromS(DAY_S * 6),
            timeRoundTo: DeltaTime.fromS(DAY_S),
        },
        renderedTimeFormat: 'date',
    },
    {
        displayTime: DeltaTime.fromS(DAY_S * 7),
        labels: {
            distance: DeltaTime.fromS(DAY_S),
            timeRoundTo: DeltaTime.fromS(DAY_S),
        },
        renderedTimeFormat: 'date',
    },
    {
        displayTime: DeltaTime.fromS(DAY_S),
        labels: {
            distance: DeltaTime.fromS(HOUR_S * 4),
            timeRoundTo: DeltaTime.fromS(HOUR_S),
        },
        renderedTimeFormat: 'dateTime',
    },
];

type TZoomConfigItem = {
    displayTime: DeltaTime;
    labels: {
        distance: DeltaTime;
        timeRoundTo: DeltaTime;
    };
    renderedTimeFormat: TTimeRenderFormat;
};
