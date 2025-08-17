import { TWorldState } from 'data/TWorldState';
import { register } from 'data/register';
import { TCharacterId, TChapterId, TSideCharacterId } from 'types/TIds';
import { TLocationId } from 'types/TLocation';
import { Engine } from 'code/Engine/ts/Engine';
import { itemInfo } from 'data/items/itemInfo';

const ss = {
    time: register.chapters.village.timeRange.start,
    mainCharacterId: 'thomas',
    currentHistory: {},

    characters: {} as Record<TCharacterId, unknown>,
    sideCharacters: {} as Record<TSideCharacterId, unknown>,
    chapters: {} as Record<TChapterId, unknown>,
    locations: {} as Record<TLocationId, unknown>,
};

(Object.keys(register.characters) as TCharacterId[]).forEach((id) => {
    const { inventory, ...rest } = register.characters[id].init;
    ss.characters[id] = {
        ...rest,
        inventory: inventory.map((i) => ({ ...itemInfo[i.id], ...i })),
        ref: register.characters[id],
    };
});
(Object.keys(register.sideCharacters) as TSideCharacterId[]).forEach((id) => {
    const { inventory, ...rest } = register.sideCharacters[id].init;
    ss.sideCharacters[id] = {
        ...rest,
        inventory: inventory.map((i) => ({ ...itemInfo[i.id], ...i })),
        ref: register.sideCharacters[id],
    };
});
(Object.keys(register.chapters) as TChapterId[]).forEach((id) => {
    ss.chapters[id] = { ...register.chapters[id].init, ref: register.chapters[id] };
});
(Object.keys(register.locations) as TLocationId[]).forEach((id) => {
    ss.locations[id] = { ...register.locations[id].init, ref: register.locations[id] };
});

const s = ss as TWorldState;
const e = new Engine(s);

window.s = s;
window.e = e;

void e.handleAutoStart();

export { s, e };
