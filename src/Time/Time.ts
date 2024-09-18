import { HOUR_S, MIN_S } from './const';

export class Time {
    protected _timeS: number;

    constructor(timeS: number) {
        this._timeS = Math.floor(timeS);
    }

    static fromS(timeS: number) {
        return new Time(timeS);
    }

    static fromMin(timeMin: number) {
        return new Time(timeMin * MIN_S);
    }

    static now() {
        return Time.fromS(Math.floor(Date.now() / 1_000));
    }

    get s() {
        return this._timeS;
    }

    get min() {
        return Math.floor(this._timeS / MIN_S);
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
