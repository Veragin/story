import { DAY_S, HOUR_S, MIN_S, MONTH_S, MONTH_NAME } from './const';
import { Time } from './Time';

export class TimeManager {
    renderTime = (time: Time, format: TTimeRenderFormat) => {
        const { month, day, hour, min, sec } = this.parseTime(time);
        const minText = String(min).length < 2 ? `0${min}` : min;

        if (format === 'month') {
            return MONTH_NAME[month];
        }

        let res = `${hour}:${minText}`;
        if (format.startsWith('date')) {
            res = `${day + 1}.${month + 1}.`;
        }
        if (format === 'dateTime' || format === 'dateTimeSec') {
            res = `${res} ${hour}:${minText}`;
        }
        if (format === 'dateTimeSec' || format === 'timeSec') {
            const secText = String(sec).length < 2 ? `0${sec}` : sec;
            res += `:${secText}`;
        }

        return res;
    };

    renderDeltaTime = (time: DeltaTime, withSeconds?: boolean) => {
        const { month, day, hour, min, sec } = this.parseTime(time);
        const minText = String(min).length < 2 ? `0${min}` : min;

        let res = `${hour}:${minText}`;
        if (day > 0 || month > 0) {
            res = `${day} day${day === 1 ? '' : 's'} ${res}`;
        }
        if (month > 0) {
            res = `${month} month${month === 1 ? '' : 's'} ${res}`;
        }
        if (withSeconds) {
            const secText = String(sec).length < 2 ? `0${sec}` : sec;
            res += `:${secText}`;
        }

        return res;
    };

    isDay = (time: Time) => {
        const { hour } = this.parseTime(time);
        return hour >= 6 && hour <= 22;
    };

    parseTime = (time: Time | DeltaTime) => {
        const month = Math.floor(time.s / MONTH_S);
        let restS = time.s - month * MONTH_S;
        const day = Math.floor(restS / DAY_S);
        restS = restS - day * DAY_S;
        const hour = Math.floor(restS / HOUR_S);
        restS -= hour * HOUR_S;
        const min = Math.floor(restS / MIN_S);
        restS -= min * MIN_S;
        const sec = restS - min * MIN_S;

        return { month, day, hour, min, sec };
    };

    roundTo = (time: Time, base: DeltaTime) => {
        const part = time.s % base.s;
        return Time.fromS(time.s - part);
    };
}

export type TTimeRenderFormat = 'month' | 'date' | 'dateTime' | 'dateTimeSec' | 'time' | 'timeSec';
