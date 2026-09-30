import type {
    TChapterDto,
    TChapterLayoutFile,
    TCharacterDto,
    TItemDto,
    TLocationDto,
    TMapFile,
    TNpcDto,
    TPassageDto,
    TTimelineLayoutFile,
    TTriggerDto,
} from '@story/visualizer-protocol';

/**
 * Seed for `mockApi`: the sample story of `data/` as the server's readers would return it
 * (versions are filled in by the mock). A hand-written copy, not an import — the client must not
 * import `@story/data` at runtime (plan §3 "Live refresh"). It mirrors the real files closely so
 * that pages built against the mock behave the same on the real server, including the code
 * fields (`_('…')`, conditional costs, closures).
 */

type TSeed<T> = T extends unknown ? Omit<T, 'version'> : never;

export type TMockSeed = {
    chapters: TSeed<TChapterDto>[];
    passages: TSeed<TPassageDto>[];
    triggers: TSeed<TTriggerDto>[];
    characters: TSeed<TCharacterDto>[];
    npcs: TSeed<TNpcDto>[];
    locations: TSeed<TLocationDto>[];
    items: TSeed<TItemDto>[];
    maps: TMapFile[];
    timelineLayout: TTimelineLayoutFile | null;
    chapterLayouts: Record<string, TChapterLayoutFile>;
};

const chapterFile = (ch: string) => `data/chapters/${ch}/${ch}.chapter.ts`;
const passageFile = (ch: string, char: string, file: string) => `data/chapters/${ch}/${char}.passages/${file}`;

export const createMockSeed = (): TMockSeed => ({
    chapters: [
        {
            chapterId: 'village',
            file: chapterFile('village'),
            exportName: 'villageChapter',
            title: 'Village Chapter',
            description: 'A village chapter is happening',
            timeRange: { start: '2.1. 8:00', end: '5.1. 8:00' },
            location: 'village',
            children: [],
            triggerIds: ['nobleHouseRobbery'],
            init: { mojePromena: { time: 0, asd: 'asd' } },
            dataType: {
                name: 'TVillageChapterData',
                code: '{\n    mojePromena: {\n        time: number;\n        asd: string;\n    };\n}',
            },
            characters: [
                {
                    characterId: 'thomas',
                    passageCount: 3,
                    passageIds: ['village-thomas-cool', 'village-thomas-forest', 'village-thomas-intro'],
                },
            ],
        },
        {
            chapterId: 'kingdom',
            file: chapterFile('kingdom'),
            exportName: 'kingdomChapter',
            title: 'Kingdom Chapter',
            description: 'A Kingdom chapter is happening',
            timeRange: { start: '2.1. 8:00', end: '5.1. 8:00' },
            location: 'village',
            children: [{ condition: 'asdasd', chapterId: 'village' }],
            triggerIds: [],
            init: { mojePromena: { time: 0, asd: 'asd' } },
            dataType: {
                name: 'TKingdomChapterData',
                code: '{\n    mojePromena: {\n        time: number;\n        asd: string;\n    };\n}',
            },
            characters: [
                {
                    characterId: 'annie',
                    passageCount: 2,
                    passageIds: ['kingdom-annie-intro', 'kingdom-annie-palace'],
                },
                { characterId: 'thomas', passageCount: 1, passageIds: ['kingdom-thomas-visit'] },
            ],
        },
        {
            chapterId: 'wedding',
            file: chapterFile('wedding'),
            exportName: 'weddingChapter',
            title: { code: "_('Wedding Chapter')" },
            description: '',
            timeRange: { start: '5.1. 9:00', end: '6.1. 8:00' },
            location: 'kingdom',
            children: [],
            triggerIds: [],
            init: {},
            dataType: { name: 'TWeddingChapterData', code: '{}' },
            characters: [],
        },
    ],

    passages: [
        {
            passageId: 'village-thomas-intro',
            chapterId: 'village',
            characterId: 'thomas',
            localId: 'intro',
            file: passageFile('village', 'thomas', 'intro.ts'),
            exportName: 'introPassage',
            params: [],
            type: 'screen',
            title: 'Intro',
            image: 'Thomas, a young hunter in a brown tunic, standing on a misty forest path.',
            body: [
                {
                    condition: { code: 'true' },
                    text: 'text',
                    links: [
                        {
                            text: 'Lets go to the forest',
                            passageId: 'village-thomas-forest',
                            cost: { time: { seconds: 600 } },
                            autoPriortiy: 1,
                        },
                    ],
                },
            ],
        },
        {
            passageId: 'village-thomas-forest',
            chapterId: 'village',
            characterId: 'thomas',
            localId: 'forest',
            file: passageFile('village', 'thomas', 'forest.ts'),
            exportName: 'forestPassage',
            params: ['s'],
            execute: {
                code: '() => {\n    if (s.characters.annie.health < 50) {\n        s.characters.annie.health += 50;\n    }\n}',
                description: 'Annie gets healed when she is weak.',
            },
            type: 'screen',
            title: 'Forest',
            image: 'Thomas, a young hunter in a brown tunic, standing on a misty forest path.',
            body: [
                {
                    condition: { code: 'true' },
                    text: 'text',
                    links: [
                        {
                            text: 'Lets hunt',
                            passageId: 'village-thomas-intro',
                            cost: { code: 's.time.s < 10 ? DeltaTime.fromMin(1) : DeltaTime.fromMin(2)' },
                            autoPriortiy: 2,
                        },
                    ],
                },
            ],
        },
        {
            passageId: 'village-thomas-cool',
            chapterId: 'village',
            characterId: 'thomas',
            localId: 'cool',
            file: passageFile('village', 'thomas', 'cool.transition.ts'),
            exportName: 'default',
            params: [],
            type: 'transition',
            nextPassageId: 'village-thomas-',
        },
        {
            passageId: 'kingdom-annie-intro',
            chapterId: 'kingdom',
            characterId: 'annie',
            localId: 'intro',
            file: passageFile('kingdom', 'annie', 'intro.ts'),
            exportName: 'introPassage',
            params: ['s'],
            type: 'screen',
            title: 'Intro',
            image: '',
            body: [
                {
                    condition: { code: 's.characters.annie.health > 0' },
                    text: 'text',
                    links: [
                        {
                            text: 'Lets go to the forest',
                            passageId: 'kingdom-annie-palace',
                            cost: { time: { seconds: 600 }, items: [{ id: 'berries', amount: 1 }] },
                            autoPriortiy: 1,
                        },
                    ],
                },
            ],
        },
        {
            passageId: 'kingdom-annie-palace',
            chapterId: 'kingdom',
            characterId: 'annie',
            localId: 'palace',
            file: passageFile('kingdom', 'annie', 'palace.ts'),
            exportName: 'palacePassage',
            params: [],
            type: 'screen',
            title: 'Palace',
            image: '',
            body: [
                {
                    condition: { code: 'true' },
                    text: 'text',
                    links: [
                        {
                            text: 'Back to intro',
                            passageId: 'kingdom-annie-intro',
                            cost: { seconds: 600 },
                            autoPriortiy: 1,
                        },
                        {
                            text: 'Back to intro with axe',
                            passageId: 'kingdom-annie-intro',
                            cost: { time: { seconds: 6000 }, tools: ['axe'] },
                            autoPriortiy: 5,
                        },
                    ],
                },
            ],
        },
        {
            passageId: 'kingdom-thomas-visit',
            chapterId: 'kingdom',
            characterId: 'thomas',
            localId: 'visit',
            file: passageFile('kingdom', 'thomas', 'visit.screen.ts'),
            exportName: 'visitPassage',
            params: ['s', 'e'],
            preamble: 'void s;\nvoid e;',
            type: 'screen',
            title: { code: "_('visit')" },
            image: '',
            body: [
                {
                    text: { code: "_('')" },
                    links: [
                        {
                            text: { code: "_('')" },
                            passageId: 'kingdom-thomas-visit',
                            cost: { seconds: 600 },
                        },
                    ],
                },
            ],
        },
    ],

    triggers: [
        {
            triggerId: 'nobleHouseRobbery',
            chapterId: 'village',
            file: 'data/chapters/village/triggers.ts',
            exportName: 'nobleHouseRobberyTrigger',
            name: 'nobleHouseRobbery',
            description: 'Noble house robbery',
            time: '1.12 0:0',
            condition: { code: '() => {\n    return true;\n}' },
            action: { code: '() => {}' },
        },
    ],

    characters: [
        {
            kind: 'characters',
            id: 'thomas',
            file: 'data/characters/thomas.ts',
            exportName: 'Thomas',
            name: 'Thomas',
            startPassageId: 'village-thomas-intro',
            init: {
                health: 100,
                inventory: [{ id: 'bow', amount: 1 }],
                location: 'village',
            },
            dataType: { name: 'TThomasCharacterData', code: '{\n    knowsMagic: boolean;\n}' },
        },
        {
            kind: 'characters',
            id: 'annie',
            file: 'data/characters/annie.ts',
            exportName: 'Annie',
            name: 'Annie',
            startPassageId: 'kingdom-annie-intro',
            init: {
                health: 100,
                inventory: [{ id: 'berries', amount: 10 }],
                location: 'village',
            },
            dataType: { name: 'TAnnieCharacterData', code: '{\n    knowsMagic: boolean;\n}' },
        },
    ],

    npcs: [
        {
            kind: 'npcs',
            id: 'franta',
            file: 'data/npcs/Franta.ts',
            exportName: 'Franta',
            name: 'Franta',
            description: 'Franta is a very old',
            init: { inventory: [], location: 'village', isDead: false },
            dataType: {
                name: 'TFrantaNpcData',
                code: '{\n    asdasd: {\n        time: number;\n        asd: string;\n    };\n}',
            },
        },
        {
            kind: 'npcs',
            id: 'nobleMan',
            file: 'data/npcs/NobleMan.ts',
            exportName: 'NobleMan',
            name: 'Noble Man',
            description: 'Noble Man is a very rich and powerful',
            init: { inventory: [], location: 'village', isDead: false },
            dataType: {
                name: 'TNobleManNpcData',
                code: '{\n    asdasd: {\n        time: number;\n        asd: string;\n    };\n}',
            },
        },
    ],

    locations: [
        {
            kind: 'locations',
            id: 'village',
            file: 'data/locations/village.location.ts',
            exportName: 'villageLocation',
            name: 'Village',
            description: 'The village is a small place, with a few houses and a tavern.',
            localCharacters: [{ name: 'Pepa', description: 'Pepa is a very smart' }],
            init: {},
            dataType: {
                name: 'TVillageLocationData',
                code: '{\n    mojePromena: {\n        time: number;\n        asd: string;\n    };\n}',
            },
        },
        {
            kind: 'locations',
            id: 'kingdom',
            file: 'data/locations/kingdom.location.ts',
            exportName: 'kingdomLocation',
            name: { code: "_('kingdom')" },
            description: '',
            localCharacters: [],
            init: {},
            dataType: { name: 'TKingdomLocationData', code: '{}' },
        },
    ],

    items: [
        {
            kind: 'items',
            id: 'gold',
            file: 'data/items/itemInfo.ts',
            source: 'itemInfo',
            name: 'Gold',
            type: 'value',
            props: {},
        },
        {
            kind: 'items',
            id: 'berries',
            file: 'data/items/foodInfo.ts',
            source: 'foodInfo',
            name: 'Berries',
            type: 'food',
            props: { hungerValue: 5 },
        },
        {
            kind: 'items',
            id: 'axe',
            file: 'data/items/toolInfo.ts',
            source: 'toolInfo',
            name: 'Axe',
            type: 'tool',
            props: { dmg: 10 },
        },
        {
            kind: 'items',
            id: 'wood',
            file: 'data/items/itemInfo.ts',
            source: 'itemInfo',
            name: 'Wood',
            type: 'resource',
            props: {},
        },
        {
            kind: 'items',
            id: 'bow',
            file: 'data/items/itemInfo.ts',
            source: 'itemInfo',
            name: 'Bow',
            type: 'weapon',
            props: { damage: 10, asd: { asd: 'asdas', time: false } },
        },
    ],

    maps: [createSampleMap()],
    timelineLayout: null,
    chapterLayouts: {},
});

/** A small 12×8 map with two location polygons, enough to exercise every map feature. */
function createSampleMap(): TMapFile {
    const width = 12;
    const height = 8;
    const data: TMapFile['data'] = [];
    for (let i = 0; i < height; i++) {
        const row: TMapFile['data'][number] = [];
        for (let j = 0; j < width; j++) {
            const tile = i < 2 ? 'water' : j > 8 ? 'mountain' : (i + j) % 5 === 0 ? 'forest' : 'grass';
            row.push({ tile });
        }
        data.push(row);
    }
    data[4][3] = { tile: 'city', label: 'Village', description: 'A few houses and a tavern.' };
    data[3][7] = { tile: 'city', label: 'Castle', description: 'The seat of the kingdom.' };
    return {
        mapId: 'global',
        title: 'World',
        width,
        height,
        data,
        palette: {
            none: { name: 'None', color: '#000000' },
            grass: { name: 'Grass', color: '#D3E671' },
            water: { name: 'Water', color: '#9EC6F3' },
            forest: { name: 'Forest', color: '#89AC46' },
            mountain: { name: 'Mountain', color: '#B7B7B7' },
            city: { name: 'City', color: '#9F5255' },
        },
        locations: {
            village: {
                polygon: [
                    { x: 100, y: 180 },
                    { x: 260, y: 180 },
                    { x: 260, y: 320 },
                    { x: 100, y: 320 },
                ],
                fill: 'rgba(159, 82, 85, 0.35)',
            },
            kingdom: {
                polygon: [
                    { x: 380, y: 120 },
                    { x: 560, y: 140 },
                    { x: 540, y: 300 },
                    { x: 400, y: 280 },
                ],
            },
        },
        maps: [],
    };
}
