---
name: entities
description: How to create, change and delete chapters, characters, npcs, locations, items and time triggers, with the exact file shapes and the registry entries each one needs. Load before touching data/characters, data/npcs, data/locations, data/items, a <ch>.chapter.ts or a triggers.ts.
---

# Chapters, entities, items and triggers

Each kind has a fixed file shape. Copy it exactly: the Visualizer reads these objects field by field. After
creating one, add it to `data/register.ts` and `data/TWorldState.ts` (the story-files skill shows both).

Ids are lowerCamelCase without `-`. `<Id>` below is the id with a capital first letter.

## Character: `data/characters/<id>.ts`

```ts
import type { Character } from '@story/types';

export const Thomas: Character<'thomas'> = {
    id: 'thomas',
    name: _('Thomas'),
    startPassageId: 'village-thomas-intro',

    init: {
        health: 100,
        inventory: [{ id: 'bow', amount: 1 }],
        location: 'village',
    },
};

export type TThomasCharacterData = {
    knowsMagic: boolean;
};
```

- Export name `<Id>`; register as `characters: { thomas: Thomas }`; world state
  `thomas: { ref: Character<'thomas'> } & TCharacterData & Partial<TThomasCharacterData>;` (import
  `TThomasCharacterData` from `./characters/thomas`).
- `init` holds the starting values of `TCharacterData` (`health`, `inventory`, `location?`) plus the character's own
  data type. `startPassageId` is a passage of this character.
- A playable character needs passages: a `<id>.passages/` folder in at least one chapter (passages skill).

## Npc: `data/npcs/<Id>.ts`

```ts
import type { Npc } from '@story/types';

export const Franta: Npc<'franta'> = {
    id: 'franta',
    name: _('Franta'),
    description: _('Franta is very old.'),

    init: {
        inventory: [],
        location: 'village',
        isDead: false,
    },
};

export type TFrantaNpcData = {};
```

Register as `npcs: { franta: Franta }`; world state `franta: { ref: Npc<'franta'> } & TNpcData & Partial<TFrantaNpcData>;`.
`location` may be `undefined`.

## Location: `data/locations/<id>.location.ts`

```ts
import type { Location } from '@story/types';

export const villageLocation: Location<'village'> = {
    id: 'village',
    name: _('Village'),
    description: _('A small place with a few houses and a tavern.'),

    localCharacters: [
        {
            name: _('Pepa'),
            description: _('The smith, very smart.'),
        },
    ],

    init: {},
};

export type TVillageLocationData = {};
```

Register as `locations: { village: villageLocation }`; world state
`village: { ref: Location<'village'> } & TVillageLocationData;`. The shape on the map is drawn by the author in the
Visualizer (`map.json`); don't write it. A location inside another one is named `<parent>_<name>`
(`village_tavern`).

## Items: `data/items/`

Items are entries of one object, not files. Food goes into `foodInfo.ts`, tools into `toolInfo.ts`, everything
else into `itemInfo.ts`, which spreads the other two:

```ts
export const toolInfo = {
    axe: {
        name: _('Axe'),
        type: 'tool',
        dmg: 10,
    },
} as const satisfies Record<string, TItemInfo & Record<string, unknown>>;
```

- `name` and `type` are required; `type` is one of the `TItemType` union in `itemInfo.ts` (add a value there for a
  new kind). Extra fields are free (`dmg`, `hungerValue`).
- Changing an item's type to or from `food` / `tool` moves the entry to the matching file.
- `TItemId` is derived from `itemInfo`, so the item can be used in inventories and costs at once.

## Chapter: `data/chapters/<ch>/<ch>.chapter.ts`

```ts
import { Time } from '@story/shared';
import { TChapter } from '@story/types';
import { nobleHouseRobberyTrigger } from './triggers';

export const villageChapter: TChapter<'village'> = {
    chapterId: 'village',
    title: _('Village'),
    description: _('Thomas spends a day in the village.'),
    timeRange: {
        start: Time.fromString('2.1. 7:00'),
        end: Time.fromString('5.1. 7:00'),
    },
    location: 'village',

    children: [],

    triggers: [nobleHouseRobberyTrigger],

    init: {},
};

export type TVillageChapterData = {};
```

- A new chapter also needs `<ch>.passages.ts` (passages skill; with no passages yet it is
  `export type T<Ch>PassageId = never;` and an empty `Record`), `register.chapters` (`village: villageChapter`),
  `register.passages` (`village: () => import('./chapters/village/village.passages')`) and world state
  `village: { ref: TChapter<'village'> } & TVillageChapterData;`.
- `timeRange`: `Time.fromString('<day>.<month>. <h>:<min>')`. `location` is a location id.
- `children`: the chapters that may follow, `{ condition: string, chapter: kingdomChapter }` (import the other
  chapter's object). Never the chapter itself.
- `init` holds the starting values of `T<Ch>ChapterData`.

## Time trigger: `data/chapters/<ch>/triggers.ts`

```ts
import { Time } from '@story/shared';
import { TTimeTrigger } from '@story/types';

export const nobleHouseRobberyTrigger: TTimeTrigger = {
    id: 'nobleHouseRobbery',
    name: 'Noble house robbery',
    description: 'Robbers break into the noble house at night.',

    time: Time.fromString('3.1. 23:00'),
    /** Only while the noble is away. */
    condition: () => true,
    action: () => {},
};
```

Export name `<id>Trigger`; trigger ids are unique across all chapters. Add it to the chapter's `triggers: [...]`
with an import from `./triggers`.

## Custom data (the `T…Data` types)

Each entity and chapter has its own data type next to it (`TThomasCharacterData`, `TVillageChapterData`). To give
it a field, add the field to the type and its starting value to `init`. Fields may use story types and ids
(`owner: TCharacterId`, `race: TRaceId`); import them from `@story/types`. Passages read and write them through
`s` (`s.characters.thomas.knowsMagic`, `s.chapters.village.robbed`).

## Deleting

Remove the file (or item entry), its `register` and `TWorldState` entries and the data type import, then `Grep`
for the id and fix every reference: inventories and costs (items), `location` fields (locations), `startPassageId`
and `<id>.passages/` folders (characters), `children` (chapters).
