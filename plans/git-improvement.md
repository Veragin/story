# Structures

- add new Structure type `class` that will replace the `type` type, the `type` will be used differently
- class type will generate class eg. `class Character`
- the Entities can be created only from class strucutre (not type anymore)
- add the class to @clients/Visualizer/src/pages/Structure/DataTypeSection.tsx
- convert all data (demo and example) to use classes (Character, Npc, ....)
- `type` type is used to define some typed structure
- keep the literals as they are

example

- lets have `class A { ch: Character, d: Data }` where `class Character { a: number }` and `type Data = { b: number }`
- when creating entity of A
    - for ch user has to select from the list of already created entities of Character
    - for d user can freely edit the value of b inside an object ... but the object has fixed asn defiend structure

add private types and literals support

- under Structures under the class user can create private types or literals that will can be used only in the class, saved in the same file as the class

---

# Implementation plan

## Where we are today

- One structure kind, `type` (`TStructTypeDto`, `origin: story | extendable | engine`). A story type with **"Has a catalog"** gets instances: `data/catalogs/<plural>.ts` (`satisfies Record<string, TName>`) + `T<Name>Id`; fields typed `T<Name>Id` are `ref`s (picked from the existing instances).
- Built-in entity kinds (`characters`, `npcs`, `locations`, `items`) are hard-coded: `TCharacter` / `TNpc` / `TLocation` / `TItemInfo` are `extendable` types, their instances live in `register.ts` / `data/items/*Info.ts`, `BUILT_IN_REF_TARGETS` maps them to ref targets.
- A field typed with another named object type (`d: TData`) is read as `{ t: 'code' }` (read-only), so "fixed structure, freely editable values" does not exist yet.
- Literals are `global` (`types/literals.ts`) or `local` (declared in the file that uses them).

## Decisions (proposed defaults — confirm before starting)

1. **Class source form**: a declaration-only TS class, instances stay plain object literals (structural typing), so every AST reader/writer that works on object literals keeps working:
   ```ts
   export class Race {
       declare name: string;
       declare kin?: TClanId;
   }
   export type TRaceId = keyof typeof races;
   ```
   `declare` fields because `useDefineForClassFields: true` would otherwise emit/initialize them. Instances: `export const elf: Race = { … }` / `races = { … } satisfies Record<string, Race>`. No `new Race(...)`.
2. **Naming**: class = `PascalCase` without prefix (`Character`, `Race`), its id type keeps `T<Name>Id` (`TCharacterId`, `TRaceId`) so existing ids and `ref` fields don't change. `type` keeps the `T` prefix (`TData`). → `refIdTypeName('Race') = 'TRaceId'`, `refNameOfIdType('TRaceId') = 'Race'`. `TItem` and `TChapter` keep their `T` names and their ids (`TItemId`, `TChapterId`):
   - `refIdTypeName` branches on the `T[A-Z]` prefix of the name (`TItem` → `TItemId`, `Race` → `TRaceId`);
   - `refNameOfIdType` can't (every id starts with `T`), so it uses an explicit exception map `{ TItemId: 'TItem', TChapterId: 'TChapter' }`, otherwise strips `T…Id`.
   - New `CLASS_NAME_RE = /^(?!T[A-Z])[A-Z][A-Za-z0-9]*$/` next to `STRUCT_NAME_RE` (a class can't look like a type). Reserved class names: `Item`, `Chapter` (their ids would collide with `TItemId` / `TChapterId`).
3. **Import as type only**: data files do `import type { Character } from '@story/types'`, so the `types ⇄ data` cycle stays type-only (`@story/types` already has runtime code, e.g. `getWholePassageId`, so this is about the cycle, not about the package being runtime-free).
4. **Engine classes are generic**: `export class Character<Ch extends TCharacterId> { declare id: Ch; … declare init: …; }` — same members as today's `TCharacter`, so the engine (`clients/shared/core`) only needs renamed imports.
5. **`type` means "named structure, no instances"**: a field typed `TData` becomes a new `TTypeRef` `{ t: 'struct'; name: 'TData' }` edited as a fixed-shape object (fields can't be added/removed, values can).
6. **Private** = declared in the class file and **not exported** (TS enforces "only usable in the class"). Visible in Structures nested under the class. Private names are unique across the whole story (like literals today), so name resolution needs no scoping beyond "usable only in the owner's file". Entity data types (`T…CharacterData` in `data/characters/*.ts`) live outside the class file, so private types/literals are **not** offered there.
7. **Items stay as they are**: `TItemInfo` (extendable type, instances in `data/items/*Info.ts`) and `TItem<I>` are not converted. Items stay a hard-coded entity kind, and `ref` to `TItem` keeps working through `BUILT_IN_REF_TARGETS`.
8. **A `type` may reference a class**: `type TData = { owner: TCharacterId }` is allowed. It's stored as a `ref`, and the value is picked from the class's entities.
9. **Class fields store ids**: the requirement's `class A { ch: Character }` is written `ch: TCharacterId` (UI shows "class Character"). Intentional.
10. **`Location` keeps its name** even though it shadows the DOM global `Location` (`lib` includes `DOM`). Every file using it must import it from `@story/types`; generated code always adds the import.
11. **No recursive `type`s**: `type TA = { b: TA }` (directly or through other types, arrays, objects) is refused on create/update — `typeDefault` / `schemaOf` would not terminate.

## Phase 1 — protocol (`protocol/src/dto/structure.ts`, `typeText.ts`)

- `TStructKind = 'class' | 'type'`; add `kind` to `TStructTypeDto`. `catalog` is set iff `kind === 'class'` (rename later to `instances` only if it stays readable — keep `catalog` for now to limit churn).
- Add `owner?: string` (class name) to `TStructTypeDto` and `TLiteralDto`; `TLiteralScope` gets `'private'`.
- `TTypeRef`: add `{ t: 'struct'; name: string }`. Update `typeDefault` (needs `ctx.structFields(name)`), `refToTypeText` (`name`), `refTypeNames` (the name, for imports), `NEEDS_NO_PARENS` (add `'struct'`), `inferTypeRef` untouched.
- `TTypeDefaultContext` + `typeDefaultContext()` gain `structFields`.
- `refIdTypeName` / `refNameOfIdType` per decision 2; `BUILT_IN_REF_TARGETS` keys → `Character`, `Npc`, `Location`, `TItem`, `TChapter` (item and chapter keep their current names).
- `TCreateTypeBody` → `{ kind, name, fields, catalog?, owner? }` (`catalog` required for `class`, forbidden for `type`); `TCreateLiteralBody` gets `owner?`.
- `structNameError(name, taken, kind)` validates by kind (incl. reserved class names, decision 2).
- `protocol/src/dto/entity.ts:16` comment: `TCharacter` / `TNpc` / `TLocation` → class names.
- Tests: `protocol/__tests__` for the name/id helpers, `typeDefault` of `struct`, text generation.

## Phase 2 — server reader (`server/src/project/readers/structure.ts`)

- Read `ClassDeclaration`s in `types/` next to type aliases: `kind: 'class'`, fields from `declare` property declarations (reuse `typeLiteralFields` logic on `PropertyDeclaration`s — extract a shared `memberFields` helper for `PropertySignature | PropertyDeclaration`). A class with methods/initializers/non-`declare` members → `code` (read-only), like an unparsable type. Generic story classes → `code` too (same rule as type aliases with type parameters), but the built-in generic classes (`Character<Ch>`, `Npc<Ch>`, `Location<L>`) go through the extendable path, which ignores type parameters.
- Class's catalog = the `satisfies Record<string, Name>` export (already generic via `readCatalogs`); built-in classes map to register sections / item infos as before.
- `EXTENDABLE_FIELDS` / `ENGINE_FIELD_TYPES` / `ENGINE_TYPES` re-keyed to class names (`Character`, `Npc`, `Location`); `TItemInfo`, `TCharacterData` and `TNpcData` stay extendable *types*.
- `typeNodeToRef`: a reference to a known story `type` name → `{ t: 'struct', name }`; to a class name directly (`ch: Character`) → report a diagnostic suggesting `TCharacterId` (a class field always stores the id). Skip locked engine fields: `Location.sublocations` is `Location<TLocationId>[]` (nested objects) and stays mapped by `ENGINE_FIELD_TYPES`.
- `TTypeNames` gains `structs` (story `type` names) next to `literals` / `refs`.
- `readStructType` currently drops non-exported aliases — allow them in class files (private).
- Private: in a class file, non-exported aliases → `owner = className` (types and literals); `readLiterals` sets `scope: 'private'` for them. `TTypeNames` gets per-file visibility so a private name resolves only inside its file.
- `entities.ts`: `ENTITY_TYPES` → class names; `readDataType` unchanged (data types stay `type`s).

## Phase 3 — server writers

- `writers/structure.ts`:
  - `createType` branches on `kind`: class → `export class X { declare …; }` + `TXId` + catalog file (current catalog path, now mandatory); type → `export type TX = { … }` (no catalog option).
  - `rewriteMembers` / `addMember` / `updateMember` work on a class body too (`ClassDeclaration.addProperty({ hasDeclareKeyword: true, … })`) — abstract over "members container".
  - `owner` set → write into the owner's file, not exported, no barrel line.
  - `deleteType` / `ownsFile` / `typeReferences`: class + its private types/literals go together; refuse while referenced from outside.
- `writers/literals.ts`: `owner` → declare in the class file (reuse the `local` path with `file = owner's file`).
- `writers/structureBody.ts`: `parseFields` accepts `struct`; `assertKnownNames` checks private names only within their owner.
- `writers/idCycles.ts`: follow `struct` edges too (`Race → TData → TRaceId`).
- `values.ts` (`schemaOf`, `genValue`, read): `struct` = object schema with the fields of the named type, closed (no extra keys).
- `typeInstances.ts`: updating a `type` must migrate every value typed by it — new pass: walk class instances (story catalogs **and** built-in entity files' `init`) and chapter data (`T…ChapterData` values are not class instances), and rewrite the nested objects at fields whose type is `struct` of that name (recursively via arrays/objects).
- `clearReferences.ts`: recurse into `struct` values when clearing refs; `CHAPTER_FIELDS` ref `'TLocation'` → `'Location'`.
- `writers/entities.ts`: new-entity templates (`import { TCharacter }`, `TCharacter<'id'>`, the `TWorldState` line `{ ref: TCharacter<'id'> }`, `storyTypes`, the kind → type map at the bottom) → `import type { Character }`, `Character<'id'>`, etc. Without this, creating an entity after migration writes broken code.
- Recursive type check (decision 11) next to `idCycles.ts`.

## Phase 4 — migration (`server/src/project/migrations/`)

New `classLayout.ts`, wired into `migrateStory.ts` **after** `migrateStructureLayout` (that one matches `types/TCharacter.ts` / `TNpc` by name; runs once on load):
- `types/TCharacter.ts` → `types/Character.ts` with `export class Character<Ch …>`; same for `TNpc`, `TLocation`. The extra exports in those files move with them (`TCharacterData`, `TNpcData`, `TLocationId`). Items are untouched.
- every catalog story type (`type TRace = {…}` with a catalog) → `class Race` in `types/Race.ts`, `TRaceId` kept; catalog `satisfies Record<string, Race>`.
- no other engine type is converted (see **Migration: decided** below).
- rename all references (ts-morph `rename` on the alias name node — covers `register`, `TWorldState`, data files, engine files), switch imports of classes to `import type`, update `types/index.ts` barrel.
- story types without catalog stay `type`s.
- Tests in `server/__tests__` with a fixture of the old layout (follow the existing `structureLayout` test).

## Phase 5 — engine, template, stories

- `server/template/types/*`: rewrite to classes (new stories start in the new layout).
- `clients/shared/core`, `clients/shared/*`, SinglePlayer, MultiEngine: rename `TCharacter`/`TNpc`/`TLocation` imports (mostly type positions — mechanical).
- `stories/example` and `stories/demo`: convert by running the migration once, review the diff, commit the result (`types/*.ts`, `data/register.ts`, `TWorldState.ts`, `characters/`, `npcs/`, `locations/`, `items/`).
- `yarn typecheck` (incl. `scripts/typecheck-stories.mjs`) and `stories/*/data/__tests__/story.test.ts` must pass.

## Phase 6 — Visualizer

- `stores/StructureStore.ts`: `classes`, `storyTypes` (kind `type`), `privateOf(className)`, `structFields(name)`; `refTypeNames` = all classes; `literalsVisibleFrom(file)` includes private ones of that file.
- **Structure page**
  - `StructureList.tsx`: tabs **Classes / Types / Literals**; under a class, its private types and literals as nested entries (indented, "+ private type", "+ private literal").
  - `CreateTypeDialog.tsx` → `CreateClassDialog.tsx` (name `Race`, catalog name — no checkbox) and `CreateTypeDialog.tsx` (name `TData`, optional `owner`). `structureDialogs.tsx`: `askNewClass`, `askNewType(owner?)`, `askNewLiteral(owner?)`.
  - `TypeEditor.tsx`: header says Class / Type / Private type of X; `CatalogLink` only for classes. Router: `#/structure/classes/:name`, keep `types`/`literals` (`shell/router.ts`, `TStructureSection`).
  - `CreateLiteralDialog.tsx`: scope `global | local | private (class X)`.
- **`StructureEditor/FieldTypePicker.tsx`** (the kind selector): the selector gets a new **`class`** option, and the current `ref` option (labelled "type") is replaced by it:
    - `class` → `{ t: 'ref', name }`: an autocomplete of all classes (built-in `Character`, `Npc`, `Location`, plus story classes, plus `TItem` / `TChapter`). The value is picked from that class's existing entities.
    - `type` → `{ t: 'struct', name }`: an autocomplete of the story types visible from the file (global plus the class's private ones). The value is a fixed-shape object.
    - `KINDS` are `TTypeRef['t']` values, so no mapping is needed: relabel `ref` as "class" in `KIND_LABEL`, add `'struct'` (label "type") after it, and add a `struct` case to `defaultOf`.
- **`DataTypeSection.tsx`**: it renders `StructureEditor` → `FieldTypePicker`, so the new `class` and `type` options show up there automatically. Things to check:
    - the free-text branch (`!value.fields`) keeps working;
    - `literals={{ file }}` stays the entity file — private types/literals of the class are not offered (decision 6);
    - `objectTypeText` emits `TCharacterId` for a class field and `TData` for a type field, and the server adds both imports (`ensureTypeImports` via `fieldTypeNames`, which now includes `struct` names).
- **Value editors**: `ValueEditor.tsx` handles `struct` → `ObjectEditor` with fixed keys (no add/remove field, no code view toggle for structure), values via `structFields`; `objectValidation.ts`, `api/mockInstances.ts`, `api/mockData.ts` updated.
- **Hard-coded ref names** `'TCharacter'` / `'TNpc'` / `'TLocation'` → class names: `pages/Entities/entityFields.ts`, `pages/Entities/LocationFields.tsx`, `pages/Chapter/ChapterInfoForm/ChapterInfoForm.tsx` (`refOptions('TLocation')`), `api/mockApi.ts`, `api/mockData.ts`, `dev/InputsPlayground.tsx`, `dev/sampleStructure.ts`.
- **Entities page**: tabs come from classes (built-in kinds first, then story classes — today's "catalog" tabs). Only classes create entities; `CreateCatalogEntryDialog`/`CatalogEntryForm` unchanged apart from naming. Rename "catalog" in the UI copy to the class name.

## Phase 7 — tests & docs

- Update/extend: `server/__tests__` (reader for classes, private members, `struct` refs, writers create/update/delete for both kinds, instance migration through `struct`), `clients/Visualizer/src/pages/Structure/__tests__`, `pages/Entities/__tests__`, `components/editors/__tests__/StructureEditor.test.tsx`, `ObjectEditor.test.tsx`.
- Example from the requirements as an end-to-end server test: `class A { ch: TCharacterId; d: TData }`, create an `A` entry, `ch` options = characters, `d` fixed shape.
- `docs/Visualizer.md` (Structure, Catalogs, Entities, routing, `TTypeRef` list) and `docs/Server.md` (migration).

## Order / PR split

1. Protocol + reader (+ tests) — read-only support for `class` and `struct`, nothing written yet. Built-in names stay `TCharacter` / `TNpc` / `TLocation` here.
2. Writers + `struct` values.
3. The rename, all at once (must typecheck end to end): migration + template + example/demo conversion + engine renames + `BUILT_IN_REF_TARGETS` / `EXTENDABLE_FIELDS` / `ENGINE_FIELD_TYPES` / `ENTITY_TYPES` rekey + `writers/entities.ts` templates + `clearReferences.ts` + the Visualizer's hard-coded ref names. Splitting it leaves the app broken in between (extendable fields not read, location pickers empty).
4. Visualizer Structure page + pickers + `DataTypeSection`.
5. Private types/literals (server + UI).
6. Docs.

## Resolved questions

1. Items: stay as they are now (decision 7).
2. `DataTypeSection`: a new `class` option in the field type selector (Phase 6).
3. A `type` may reference a class: yes (decision 8).
4. Migration: only `TCharacter`, `TNpc` and `TLocation` become classes; the rest stays `type` (see below).

## Migration: decided

None of the three repo stories (`stories/example`, `stories/demo`, `server/template`) has a story-defined type or a catalog. The only conversions are these engine types, in all three stories:

| Type | Becomes | Instances live in |
| --- | --- | --- |
| `TCharacter<Ch>` | class `Character<Ch>` | `data/characters/*.ts`, `register.characters` |
| `TNpc<Ch>` | class `Npc<Ch>` | `data/npcs/*.ts`, `register.npcs` |
| `TLocation<L>` | class `Location<L>` | `data/locations/*.ts`, `register.locations` |

**Everything else stays `type`**, unchanged:
- `TChapter`, `TTimeTrigger`, the `TPassage*` family, `TLink`, `TLinkCost`, `TEngineSettings`;
- `TCharacterData`, `TNpcData` and the per-entity data types (`T…CharacterData`, `T…NpcData`, `T…LocationData`, `T…ChapterData`);
- `TLinkClick`, `TOnLinkClick`, `TTopbarProps`;
- ids, items (`TItem`, `TItemPartial`, `TInitInventory`, `TItemInfo`) and literals.

No story created in the app has its own types yet, so the migration needs no rule for story types without a catalog, and there is no "Convert to class" action.
