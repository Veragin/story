import { TWorldState } from 'data/TWorldState';
import { DeltaTime, Time } from 'time/Time';

export const loadWorldState = (stateString: string): TWorldState => {
    const state = JSON.parse(stateString);
    replaceTime(state);
    return state;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const replaceTime = (o: any) => {
    Object.keys(o).forEach((key) => {
        if (o[key]._timeS !== undefined) {
            o[key] = new Time(o[key]._timeS);
        }
        if (o[key]._deltaTimeS !== undefined) {
            o[key] = new DeltaTime(o[key]._deltaTimeS);
        }
        if (typeof o[key] === 'object') {
            replaceTime(o[key]);
        }
        if (Array.isArray(o[key])) {
            o[key].forEach((oo) => replaceTime(oo));
        }
    });
};
