---
name: story-files
description: The story's folder layout, file naming, ids, the registry files (register.ts, TWorldState.ts) and where the engine API lives. Load before creating, moving or deleting any story file, or when you need to find something.
---

# Story files

The working directory is one story. Only `data/` and `types/` can be changed.

```
data/
  index.ts                          the @story/data barrel (register, TWorldState, itemInfo, engine)
  register.ts                       every chapter, character, npc and location + the lazy passage imports
  TWorldState.ts                    the shape of the world state: one entry per character, npc, chapter, location
  chapters/
    timeline.layout.json            Visualizer only (chapter positions on the timeline)
    <ch>/
      <ch>.chapter.ts               export const <ch>Chapter: TChapter<'<ch>'>, plus T<Ch>ChapterData
      <ch>.passages.ts              the passage id unions and the Record of every passage of the chapter
      <ch>.layout.json              Visualizer only (passage box positions)
      triggers.ts                   time triggers of the chapter (optional)
      <character>.passages/         one folder per character that plays in the chapter
        <local>.ts                  one passage: export const <local>Passage = (s, e) => ({ … })
        <local>.png | <local>.webp  its picture (optional, binary)
      utils/                        helper functions shared by the chapter's passages (optional, any name)
  characters/<id>.ts                export const <Id>: Character<'<id>'>, plus T<Id>CharacterData
  npcs/<Id>.ts                      export const <Id>: Npc<'<id>'>, plus T<Id>NpcData
  locations/<id>.location.ts        export const <id>Location: Location<'<id>'>, plus T<Id>LocationData
  locations/map.json, <id>.map.json Visualizer only (the map and the location shapes)
  items/itemInfo.ts                 every item; food in foodInfo.ts, tools in toolInfo.ts
  catalogs/<plural>.ts              instances of a story class (see the structure skill)
  engine/index.ts                   engine settings: onLinkClick, the custom Topbar
  __tests__/, assets/               not part of the story's types; leave alone
types/
  index.ts                          the @story/types barrel: `export * from './X'` for every file
  ids.ts                            TCharacterId, TNpcId, TChapterId, the passage id helpers (derived, don't edit)
  literals.ts                       global string-literal unions
  Character.ts, Npc.ts, Location.ts built-in classes the author may extend
  TChapter.ts, TPassage.ts, TItem.ts, TTimeTrigger.ts, TEngine.ts   engine-bound types
  <Name>.ts                         the author's own classes and types
```

`<ch>` is the chapter id, `<Ch>` / `<Id>` the same id with a capital first letter (`village` → `TVillageChapterData`,
`franta` → `Franta`).

## Ids

- Every id (chapter, character, npc, location, item, trigger, passage local id, catalog entry) matches
  `/^[a-z][A-Za-z0-9_]*$/`: lowerCamelCase, no `-`. Ids are never renamed.
- A passage id is `<chapter>-<character>-<local>`: `village-thomas-forest` is
  `data/chapters/village/thomas.passages/forest.ts`, exported as `forestPassage`.
- The id unions are derived from the data (`TCharacterId = keyof TWorldState['characters']`, `TItemId = keyof
typeof itemInfo`, `TLocationId = keyof typeof register.locations`), so an id exists once its object is
  registered.

## References in messages

The author can point at a story object with `@<class>:<id>` in a message (`@npc:herbalist`,
`@passage:village-thomas-forest`). It means that object; find it here:

| Reference                                | Where                                                                                                                      |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `@character:<id>`                        | `data/characters/<id>.ts`                                                                                                  |
| `@npc:<id>`                              | the file in `data/npcs/` whose `id` matches; the file name is `<Id>.ts`, not the id (`Herbalist.ts` has `id: 'herbalist'`) |
| `@location:<id>`                         | `data/locations/<id>.location.ts`                                                                                          |
| `@item:<id>`                             | an entry (not a file) in `data/items/`: `itemInfo.ts` or one of the files it spreads in (`foodInfo.ts`, `toolInfo.ts`, …)  |
| `@chapter:<id>`                          | `data/chapters/<id>/<id>.chapter.ts`                                                                                       |
| `@passage:<chapter>-<character>-<local>` | `data/chapters/<chapter>/<character>.passages/<local>.ts`                                                                  |

Ids don't contain `-`, so a passage reference splits on its first two `-`. If a reference doesn't match anything,
`Grep` for the id before saying it doesn't exist.

## Imports

| Import                         | Resolves to                               | Use for                                         |
| ------------------------------ | ----------------------------------------- | ----------------------------------------------- |
| `@story/types`                 | `types/index.ts`                          | `TPassage`, `TChapter`, `Character`, ids, …     |
| `@story/data`, `@story/data/*` | `data/index.ts`, `data/*`                 | from `types/` only (type-only imports)          |
| `@story/shared`                | `/repo/clients/shared/utils/src/index.ts` | `Time`, `DeltaTime`, `TimeRange`, passage types |
| `@story/core`                  | `/repo/clients/shared/core/src/index.ts`  | `Engine` (type), `THistoryItem`                 |
| `@story/ui`                    | `/repo/clients/shared/ui/src/index.ts`    | only in `data/engine/Topbar.tsx`                |

Inside `data/` use relative imports for story files (`'../village.passages'`, `'../../../TWorldState'`) and
`import type` for anything only used as a type (`Engine`, `TWorldState`, `Character`).

## The engine API (read-only reference)

- `Time` (a point in story time) and `DeltaTime` (a duration): `/repo/clients/shared/utils/src/time/Time.ts`.
    - `Time.fromString('2.1. 7:00')` is day 2, month 1, 7:00 (`'<day>.<month>. <h>:<min>'`).
    - `DeltaTime.fromMin(10)`, `DeltaTime.fromHour(2)`, `DeltaTime.fromString('1h 30min')`.
- Passage shapes: `/repo/clients/shared/utils/src/passage.ts` (`TPassageScreen`, `TLink`, `TLinkCost`, …).
- The runtime: `/repo/clients/shared/core/src/engine/` (`Engine.ts`, `Inventory.ts`: `e.inventory.addItem({ id,
amount }, characterId)`, `removeItem`, `getItemAmount`).
- `_('text')` marks player-facing text for translation. It is a global (no import) and returns the string.

## Registry files

Creating something means writing its file **and** listing it. Deleting reverses every step.

`data/register.ts`:

```ts
import { villageChapter } from './chapters/village/village.chapter';
import { Thomas } from './characters/thomas';

export const register = {
    characters: { thomas: Thomas },
    npcs: { franta: Franta },
    chapters: { village: villageChapter },
    locations: { village: villageLocation },
    passages: {
        village: () => import('./chapters/village/village.passages'),
    },
} as const;
```

`data/TWorldState.ts` (one entry per registered object, with the matching data type imported):

```ts
characters: {
    thomas: { ref: Character<'thomas'> } & TCharacterData & Partial<TThomasCharacterData>;
};
npcs: {
    franta: { ref: Npc<'franta'> } & TNpcData & Partial<TFrantaNpcData>;
};
chapters: {
    village: { ref: TChapter<'village'> } & TVillageChapterData;
};
locations: {
    village: { ref: Location<'village'> } & TVillageLocationData;
};
```

| Create a…  | Files                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------- |
| chapter    | `<ch>.chapter.ts`, `<ch>.passages.ts`, `register.chapters`, `register.passages`, `TWorldState.chapters`       |
| passage    | `<character>.passages/<local>.ts`, the id union and the `Record` in `<ch>.passages.ts`                        |
| character  | `characters/<id>.ts`, `register.characters`, `TWorldState.characters`, a `<id>.passages/` folder in a chapter |
| npc        | `npcs/<Id>.ts`, `register.npcs`, `TWorldState.npcs`                                                           |
| location   | `locations/<id>.location.ts`, `register.locations`, `TWorldState.locations`                                   |
| item       | one entry in `itemInfo.ts`, `foodInfo.ts` (type `food`) or `toolInfo.ts` (type `tool`)                        |
| trigger    | `<ch>/triggers.ts` and the chapter's `triggers: [...]`                                                        |
| class/type | `types/<Name>.ts` and its `export *` line in `types/index.ts` (see the structure skill)                       |

A `/** … */` comment directly above `export const <ch>Chapter` is the author's description of what the chapter
should do, written in the Visualizer (unlike its player-facing `description` field). Treat it as the spec: implement
the behaviour it describes, keep it in place and don't rewrite it unless asked.

Before deleting anything, `Grep` for its id: links, `nextPassageId`, `redirect`, `startPassageId`, `location`,
inventories and catalog fields may still point at it.

## Pictures

The picture of a passage, character, npc or location is the `.webp` or `.png` next to its `.ts` file with the same
basename (`thomas.passages/forest.ts` → `forest.png`). The `image` field is only a text description of it. A
passage may reuse another picture with `image: '@../../kingdom/annie.passages/palace.png'` (relative to the passage
file). You can't create image files.

The description is also the prompt the editor's **Generate image** button sends to an image model, so write it as a
picture: who and what is in it, where, the light and the mood. Refer to the story's own characters, npcs, locations,
items, chapters and passages with mentions: `@character:thomas`, `@npc:<id>`, `@location:village`, `@item:<id>`,
`@chapter:<id>`, `@passage:village-thomas-intro`. A mention of something with a picture sends that picture along, so
the generated image keeps its look; players and the editor show the name in its place. Use only ids that exist, and
keep the mentions already in a description when you edit it. A description that starts with `@` followed by a path is a
link, never a mention.
