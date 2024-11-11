import { TWorldState } from 'data/TWorldState';
import { DeltaTime, Time } from 'time/Time';
import { isNullish } from './typeguards';

export const copyWorldState = (state: TWorldState): TWorldState => {
    return loadWorldState(JSON.stringify(state));
};

export const loadWorldState = (stateString: string): TWorldState => {
    const state = JSON.parse(stateString);
    replaceTime(state);
    return state;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const replaceTime = (o: any) => {
    Object.keys(o).forEach((key) => {
        if (isNullish(o[key])) {
            return;
        }
        if (Array.isArray(o[key])) {
            o[key].forEach((oo) => replaceTime(oo));
            return;
        }
        if (typeof o[key] === 'object') {
            if (o[key]._timeS !== undefined) {
                o[key] = new Time(o[key]._timeS);
                return;
            }
            if (o[key]._deltaTimeS !== undefined) {
                o[key] = new DeltaTime(o[key]._deltaTimeS);
                return;
            }
            replaceTime(o[key]);
        }
    });
};
