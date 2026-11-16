---
name: passages
description: How to write, change, link and delete passages - the passage file shape, the five passage types (start, screen, linear, redirect, finish), links, costs, conditions, execute/onFinish, and the chapter's <ch>.passages.ts list. Load before touching any file under data/chapters/<ch>/<character>.passages/ or <ch>.passages.ts.
---

# Passages

A passage is one step of a character's story: a screen with text and choices, or a hidden step that redirects.
It lives in `data/chapters/<ch>/<character>.passages/<local>.ts`; its id is `<ch>-<character>-<local>`.

## The passage file

A passage file exports **a function** named `<local>Passage` that returns the passage object. The function
takes `(s, e)`, the world state and the engine; declare only the ones you use, most passages take none.

```ts
import { DeltaTime } from '@story/shared';
import { TPassage } from '@story/types';
import type { TWorldState } from '../../../TWorldState';
import { TVillageThomasPassageId } from '../village.passages';

export const forestPassage = (
    s: TWorldState
): TPassage<'village', 'thomas', TVillageThomasPassageId> => ({
    chapterId: 'village',
    characterId: 'thomas',
    id: 'forest',

    /** Annie gets healed when she is weak. */
    execute: () => {
        if (s.characters.annie.health < 50) {
            s.characters.annie.health += 50;
        }
    },

    type: 'screen',
    title: _('Forest'),
    image: 'Thomas, a young hunter in a brown tunic, standing on a misty forest path.',

    body: [
        {
            condition: true,
            text: _('The trees close in around you.'),
            links: [
                {
                    text: _('Hunt'),
                    passageId: 'village-thomas-intro',
                    cost: DeltaTime.fromMin(s.time.s < 10 ? 1 : 2),
                    autoPriortiy: 2,
                },
            ],
        },
    ],
});
```

Rules the Visualizer relies on:

- `chapterId`, `characterId` and `id` are string literals and match the file's place (`id` = the file name
  without `.ts`). The third type argument is the character's id union from `<ch>.passages.ts`.
- `type` is a literal and never changes after creation (write a new passage instead).
- Read state only through `s` and `e`. Never import a running app, a store or a world-state singleton.
- Statements before `return` are allowed (then use a block body: `=> { …; return { … }; }`), but plain object
  fields are easier for the author to edit in the Visualizer.
- A `/** … */` comment directly above `execute`, `onFinish`, a body `condition` or a trigger `condition`/`action`
  is that function's description in the Visualizer. Write one short sentence there when you add such a function.
- Player-facing text (`title`, `text`, link `text`, `description`) uses `_('…')`.

## The five types

All of them may have `execute: () => { … }`: it runs once when the passage is entered (after the fields were
evaluated, so conditions and texts see the state from before it).

| Type       | Fields                                                    | Meaning                                                                    |
| ---------- | --------------------------------------------------------- | -------------------------------------------------------------------------- |
| `start`    | `description`, `nextPassageId?`                           | the character's entry into the chapter                                     |
| `screen`   | `title`, `image`, `body: { condition?, text?, links? }[]` | a page with text and choices                                               |
| `linear`   | `title`, `image`, `body: string`, `nextPassageId?`        | a page with text and one way on                                            |
| `redirect` | `body: { condition?, redirect }[]`                        | invisible; follows the first entry whose condition holds                   |
| `finish`   | `nextPassageId`                                           | leaves the chapter: a passage of the **same character** in another chapter |

```ts
type: 'start',
description: _('Thomas, a young woodcutter, starts his day in the village.'),
nextPassageId: 'village-thomas-intro',
```

```ts
type: 'redirect',
body: [
    { condition: isDuringRobbery(s), redirect: 'village-thomas-nobleHouseRobbery' },
    { redirect: 'village-thomas-nobleHouseFront' },
],
```

```ts
type: 'linear',
title: _('Morning'),
image: 'Sunrise over the village roofs.',
body: _('The bells ring and the village wakes up.'),
nextPassageId: 'village-thomas-tavern',
```

```ts
type: 'finish',
nextPassageId: 'kingdom-thomas-visit',
```

`start`, `linear` and `screen` `nextPassageId` / link targets stay inside the chapter's ids for the character's
union; only `finish` points into another chapter. Put the last entry of a redirect without a `condition` so one
always matches.

## Body items and links (screen)

- `condition`: a boolean expression over `s` (`condition: s.characters.thomas.health > 50`). The item shows only
  when it is true; omit it or use `true` for always.
- `text`: the paragraph. Several body items make several paragraphs, each with its own condition.
- `links`: the choices. `{ text, passageId, cost?, autoPriortiy?, onFinish? }`.
    - `passageId`: the target's full id.
    - `cost`: a `DeltaTime` (time only) or `{ time?, items?, tools? }`: `items` are consumed
      (`[{ id: 'gold', amount: 1 }]`), `tools` are only required (`['axe']`). Item ids come from `data/items/`.
    - `autoPriortiy` (spelled like that): the choice an engine-played character takes; higher wins.
    - `onFinish: () => e.inventory.addItem({ id: 'meat', amount: 1 }, 'thomas')`: runs after the choice.

```ts
{
    text: _('Buy meat (1 gold)'),
    passageId: 'village-thomas-talkInkeeper',
    cost: { time: DeltaTime.fromMin(5), items: [{ id: 'gold', amount: 1 }] },
    /** Thomas gets the meat he paid for. */
    onFinish: () => e.inventory.addItem({ id: 'meat', amount: 1 }, 'thomas'),
},
```

Shared logic for several passages goes into a helper under the chapter (`data/chapters/<ch>/utils/<name>.ts`,
plain exported functions taking `s` / `e`), not into a passage file.

## `<ch>.passages.ts`: the chapter's list

Every passage is listed here. A new passage needs both its id in the character's union and a `Record` entry:

```ts
import type { Engine } from '@story/core';
import type { TWorldState } from '../../TWorldState';
import { TChapterPassage } from '@story/types';
import { introPassage } from './thomas.passages/intro';
import { forestPassage } from './thomas.passages/forest';

export type TVillagePassageId = TVillageThomasPassageId;

export type TVillageThomasPassageId =
    | 'village-thomas-intro'
    | 'village-thomas-forest';

const villageChapterPassages: Record<
    TVillagePassageId,
    (s: TWorldState, e: Engine) => TChapterPassage<'village'>
> = {
    'village-thomas-intro': introPassage,
    'village-thomas-forest': forestPassage,
};

export default villageChapterPassages;
```

- One union per character, `T<Ch><Character>PassageId`, and the chapter union `T<Ch>PassageId` joins them
  (`TKingdomAnniePassageId | TKingdomThomasPassageId`).
- **A chapter's characters are its `<character>.passages/` folders.** To add a character to a chapter, create the
  folder with its first passage (`intro`, usually type `start` or `screen`), add its union to the chapter union
  and the entry to the `Record`.

## Making the passage reachable

A new passage is reached through a link, a `redirect`, a `nextPassageId`, or the character's `startPassageId`
(`data/characters/<id>.ts`). Add the way in, or tell the author it still needs one.

## Deleting a passage

Delete the file, its union member and its `Record` entry, then `Grep` for the full id (`'village-thomas-forest'`)
and fix every link, redirect, `nextPassageId` and `startPassageId` that pointed at it. The picture next to it
(`forest.png` / `.webp`) can't be deleted by you; mention it.
