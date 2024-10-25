import { DAY_S, HOUR_S, MIN_S, MONTH_S } from './const';

type DeltaTimeStringFormat =
    | `${number}months`
    | `${number}d`
    | `${number}h`
    | `${number}min`
    | `${number}s`
    | `${number}months ${number}d`
    | `${number}d ${number}h`
    | `${number}h ${number}min`
    | `${number}min ${number}s`
    | `${number}months ${number}d ${number}h ${number}min ${number}s`
    | `${number}d ${number}h ${number}min ${number}s`
    | `${number}h ${number}min ${number}s`
    | `${number}min ${number}s`;

type TimeStringFormat = `${number}.${number} ${number}:${number}:${number}` | `${number}.${number} ${number}:${number}`;

export class Time {
    protected _timeS: number;

    constructor(timeS: number) {
        this._timeS = Math.floor(timeS);
    }

    static fromS(timeS: number) {
        return new Time(timeS);
    }

    static from(data: Partial<{ month: number; day: number; hour: number; min: number; sec: number }>) {
        const { month = 0, day = 0, hour = 0, min = 0, sec = 0 } = data;
        return new Time(month * MONTH_S + day * DAY_S + hour * HOUR_S + min * MIN_S + sec);
    }

    static fromString(s: TimeStringFormat) {
        const [date, time] = s.split(' ');
        const [day, month] = date.split('.').map(Number);
        const [hour, min, sec] = time.split(':').map(Number);
        return Time.from({ month: month - 1, day: day - 1, hour, min, sec });
    }

    static min(t1: Time, t2: Time) {
        return Time.fromS(Math.min(t1.s, t2.s));
    }

    static max(t1: Time, t2: Time) {
        return Time.fromS(Math.max(t1.s, t2.s));
    }

    get s() {
        return this._timeS;
    }

    isEqual(otherTime: Time) {
        return this.s === otherTime.s;
    }

    isBefore(otherTime: Time) {
        return this.s < otherTime.s;
    }

    isAfter(otherTime: Time) {
        return this.s > otherTime.s;
    }

    moveToFutureBy(deltaTime: DeltaTime) {
        return Time.fromS(this.s + deltaTime.s);
    }

    moveToHistoryBy(deltaTime: DeltaTime) {
        return Time.fromS(this.s - deltaTime.s);
    }

    distance(time: Time) {
        return DeltaTime.fromS(Math.abs(this.s - time.s));
    }
}

export class DeltaTime {
    protected _deltaTimeS: number;
    constructor(deltaTimeS: number) {
        this._deltaTimeS = Math.floor(deltaTimeS);
    }

    static fromString(s: DeltaTimeStringFormat) {
        const parts = s.split(' ');
        let months = 0,
            days = 0,
            hours = 0,
            mins = 0,
            secs = 0;

        parts.forEach((part) => {
            if (part.endsWith('months')) {
                months = parseInt(part.slice(0, -6), 10);
            } else if (part.endsWith('d')) {
                days = parseInt(part.slice(0, -1), 10);
            } else if (part.endsWith('h')) {
                hours = parseInt(part.slice(0, -1), 10);
            } else if (part.endsWith('min')) {
                mins = parseInt(part.slice(0, -3), 10);
            } else if (part.endsWith('s')) {
                secs = parseInt(part.slice(0, -1), 10);
            }
        });

        return new DeltaTime(months * MONTH_S + days * DAY_S + hours * HOUR_S + mins * MIN_S + secs);
    }

    static fromS(deltaTimeS: number) {
        return new DeltaTime(deltaTimeS);
    }

    static fromMin(deltaTimeMin: number) {
        return new DeltaTime(deltaTimeMin * MIN_S);
    }

    static fromHour(timeHour: number) {
        return new DeltaTime(timeHour * HOUR_S);
    }

    static distance(time1: Time, time2: Time) {
        return new DeltaTime(Math.abs(time1.s - time2.s));
    }

    get s() {
        return this._deltaTimeS;
    }

    get min() {
        return this._deltaTimeS / MIN_S;
    }

    get hour() {
        return this._deltaTimeS / HOUR_S;
    }
}

export class TimeRange {
    constructor(
        public start: Time,
        public end: Time
    ) {}

    static fromDuration(start: Time, duration: DeltaTime) {
        return new TimeRange(start, start.moveToFutureBy(duration));
    }

    static fromDurationString(start: TimeStringFormat, duration: DeltaTimeStringFormat) {
        return new TimeRange(
            Time.fromString(start),
            Time.fromString(start).moveToFutureBy(DeltaTime.fromString(duration))
        );
    }

    static fromString(start: TimeStringFormat, end: TimeStringFormat) {
        return new TimeRange(Time.fromString(start), Time.fromString(end));
    }
}
