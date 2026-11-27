---
name: structure
description: How to define the story's own data model in types/ - classes with catalogs (data/catalogs), types, global/local/private string-literal unions, and extending the built-in Character, Npc, Location, TItemInfo, TCharacterData and TNpcData. Load before editing anything under types/ or data/catalogs/.
---

# Structure: classes, types, literals

The Visualizer's Structure page reads `types/` with strict rules. Anything outside these shapes is shown only as
code, so keep to them.

## Literals: string-literal unions

```ts
export type TMood = 'calm' | 'angry' | 'afraid';
```

- **Global**: in `types/literals.ts` (replace its `export {};` placeholder with the first one).
- **Local**: in the one data file that uses it (`TItemType` in `data/items/itemInfo.ts`).
- **Private** to a class: declared **without** `export` in the class's file, used only there.
- Names are `T` + PascalCase and unique across the whole story. Never name one `T…Id`.

## Classes: structures with instances

A class is declaration-only, in its own file `types/<Name>.ts`, with a catalog of instances in
`data/catalogs/<plural>.ts`:

```ts
// types/Race.ts
import type { races } from '@story/data/catalogs/races';
import type { TLocationId } from './Location';

type TTemper = 'calm' | 'wild';

export class Race {
    declare name: string;
    /** How strong its members are. */
    declare strength: number;
    declare home?: TLocationId;
    declare temper: TTemper;
}

export type TRaceId = keyof typeof races;
```

```ts
// data/catalogs/races.ts
import type { Race } from '@story/types';

export const races = {
    elf: { name: _('Elf'), strength: 3, home: 'village', temper: 'calm' },
    dwarf: { name: _('Dwarf'), strength: 5, temper: 'wild' },
} satisfies Record<string, Race>;
```

and in `types/index.ts`:

```ts
/* Race, TRaceId */
export * from './Race';
```

- Class names are PascalCase **without** a `T` prefix; `Item` and `Chapter` are reserved. The id type is
  `T<Name>Id`, the catalog a lowerCamelCase plural.
- Fields are `declare`d properties only: no methods, initializers, modifiers or generics. A `/** … */` above a
  field is its description.
- Instances are plain object literals, never `new`. Data files import classes with `import type`.
- A field that points at another class stores its **id**: `owner: TCharacterId`, `race: TRaceId`,
  `items: TItemId[]` (never `owner: Character`).
- No id cycles: a class must not reach its own id type through its fields (`Race.kin: TRaceId[]`, or through
  another class or type). TypeScript turns such ids into `any`.

Entities and data types use the class through its id: add `race: TRaceId` to `TThomasCharacterData` and
`race: 'elf'` to the character's `init`.

## Types: named structures without instances

```ts
// types/TStats.ts
export type TStats = {
    strength: number;
    owner?: TCharacterId;
};
```

- `T` + PascalCase, in `types/<Name>.ts`, plus an `export *` line in `types/index.ts`. Import story ids it uses
  from `./ids` or the file that declares them.
- A field typed `TStats` holds a nested object with exactly those fields.
- No recursion: a type must not contain itself, directly or through others.
- A **private** type of a class is declared without `export` in the class's file and is used only there.

## Built-in classes and types (extendable)

`Character` (`types/Character.ts`), `Npc` (`types/Npc.ts`), `Location` (`types/Location.ts`), and the types
`TCharacterData`, `TNpcData` (same files) and `TItemInfo` (`data/items/itemInfo.ts`). Their existing members
belong to the engine: never change or remove them. You may **add** fields:

```ts
export class Character<Ch extends TCharacterId> {
    declare id: Ch;
    declare name: string;
    // … engine members unchanged …
    declare race?: TRaceId;
}
```

A new field on `TCharacterData` / `TNpcData` is world state of every character / npc: give it a value in every
`init` (or make it optional). A new required class field needs a value in every instance. `TItemInfo` fields need
a value in every item.

The other files in `types/` (`ids.ts`, `TChapter.ts`, `TPassage.ts`, `TItem.ts`, `TTimeTrigger.ts`, `TEngine.ts`,
`index.ts` apart from its `export *` lines) are engine-bound: leave them alone.

## Changing a structure

When you rename or remove a field, or change its type, update every instance in the same turn: catalog entries,
entity `init`s, chapter `init`s, items, and nested objects of a struct type. `Grep` for the field name and the
type name to find them. Renaming a literal value means rewriting every place that stores it.

## Deleting

Only story classes and types can be deleted, and only when nothing uses them. A class takes its catalog file, its
private types and literals and its `index.ts` line with it.
