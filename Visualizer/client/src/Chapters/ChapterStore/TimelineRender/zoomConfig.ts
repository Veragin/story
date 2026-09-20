import { DAY_S, DeltaTime, HOUR_S, MONTH_S, TTimeRenderFormat, YEAR_S } from '@story/shared';

export const ZOOM_CONFIG: TZoomConfigItem[] = [
    {
        displayTime: DeltaTime.fromS(YEAR_S),
        labelsDistance: DeltaTime.fromS(2 * MONTH_S),
        renderedTimeFormat: 'month',
    },
    {
        displayTime: DeltaTime.fromS(YEAR_S / 2),
        labelsDistance: DeltaTime.fromS(MONTH_S),
        renderedTimeFormat: 'month',
    },
    {
        displayTime: DeltaTime.fromS(MONTH_S),
        labelsDistance: DeltaTime.fromS(DAY_S * 5),
        renderedTimeFormat: 'date',
    },
    {
        displayTime: DeltaTime.fromS(DAY_S * 7),
        labelsDistance: DeltaTime.fromS(DAY_S),
        renderedTimeFormat: 'date',
    },
    {
        displayTime: DeltaTime.fromS(DAY_S),
        labelsDistance: DeltaTime.fromS(HOUR_S * 4),
        renderedTimeFormat: 'dateTime',
    },
];

type TZoomConfigItem = {
    displayTime: DeltaTime;
    labelsDistance: DeltaTime;
    renderedTimeFormat: TTimeRenderFormat;
};
