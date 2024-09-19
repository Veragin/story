import { Time } from 'Time/Time';
import { TWorldState } from 'data/TWorldState';
import { register } from 'data/register';
import { TCharacterId, TEventId, TSideCharacterId } from 'types/TCharacter';
import { TLocationId } from 'types/TLocation';

const ss = {
    time: Time.fromMin(0),
    mainCharacterId: 'thomas',

    characters: {} as Record<TCharacterId, unknown>,
    sideCharacters: {} as Record<TSideCharacterId, unknown>,
    events: {} as Record<TEventId, unknown>,
    locations: {} as Record<TLocationId, unknown>,
};

(Object.keys(register.characters) as TCharacterId[]).forEach((id) => {
    ss.characters[id] = register.characters[id].init;
});
(Object.keys(register.sideCharacters) as TSideCharacterId[]).forEach((id) => {
    ss.sideCharacters[id] = register.sideCharacters[id].init;
});
(Object.keys(register.events) as TEventId[]).forEach((id) => {
    ss.events[id] = register.events[id].info.init;
});
(Object.keys(register.locations) as TLocationId[]).forEach((id) => {
    ss.locations[id] = register.locations[id].init;
});

const s = ss as TWorldState;

export { s };
