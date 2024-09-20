import { DAY_S, HOUR_S, MIN_S, MONTH_S } from './const';

export class Time {
    protected _timeS: number;

    constructor(timeS: number) {
        this._timeS = Math.floor(timeS);
    }

    static fromS(timeS: number) {
        return new Time(timeS);
    }

    static from(
        data: Partial<{ month: number; day: number; hour: number; min: number; sec: number }>
    ) {
        const { month = 0, day = 0, hour = 0, min = 0, sec = 0 } = data;
        return new Time(month * MONTH_S + day * DAY_S + hour * HOUR_S + min * MIN_S + sec);
    }

    static fromString(
        s:
            | `${number}.${number} ${number}:${number}:${number}`
            | `${number}.${number} ${number}:${number}`
    ) {
        const [date, time] = s.split(' ');
        const [month, day] = date.split('.').map(Number);
        const [hour, min, sec] = time.split(':').map(Number);
        return Time.from({ month: month - 1, day: day - 1, hour, min, sec });
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
        return Math.floor(this._deltaTimeS / MIN_S);
    }

    get hour() {
        return Math.floor(this._deltaTimeS / HOUR_S);
    }
}
