import { DeltaTime, type TimeManager } from '@story/shared';

export const relativeAge = (timeManager: TimeManager, date: string, now: number = Date.now()): string => {
    const seconds = Math.max(0, (now - Date.parse(date)) / 1000);
    const { year, month, day, hour, min } = timeManager.parseTime(new DeltaTime(seconds));
    if (year > 0) return _('%d y ago', year);
    if (month > 0) return _('%d mo ago', month);
    if (day > 0) return _('%d d ago', day);
    if (hour > 0) return _('%d h ago', hour);
    if (min > 0) return _('%d min ago', min);
    return _('just now');
};
