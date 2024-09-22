import { Time } from 'time/Time';
import { MONTH_S } from 'time/const';
import { TWorldState } from 'data/TWorldState';
import { register } from 'data/register';
import { TCharacterId, TEventId, TSideCharacterId } from 'types/TIds';
import { TLocationId } from 'types/TLocation';

const ss = {
    time: Time.fromS(MONTH_S * 9),
    mainCharacterId: 'thomas',

    characters: {} as Record<TCharacterId, unknown>,
    sideCharacters: {} as Record<TSideCharacterId, unknown>,
    events: {} as Record<TEventId, unknown>,
    locations: {} as Record<TLocationId, unknown>,
};

(Object.keys(register.characters) as TCharacterId[]).forEach((id) => {
    ss.characters[id] = { ...register.characters[id].init, ref: register.characters[id] };
});
(Object.keys(register.sideCharacters) as TSideCharacterId[]).forEach((id) => {
    ss.sideCharacters[id] = {
        ...register.sideCharacters[id].init,
        ref: register.sideCharacters[id],
    };
});
(Object.keys(register.events) as TEventId[]).forEach((id) => {
    ss.events[id] = { ...register.events[id].init, ref: register.events[id] };
});
(Object.keys(register.locations) as TLocationId[]).forEach((id) => {
    ss.locations[id] = { ...register.locations[id].init, ref: register.locations[id] };
});

const s = ss as TWorldState;

export { s };
