# Implementation plan: input components + Structure tab

Source spec: [`component-refacro.md`](./component-refacro.md)

## 0. Decisions

Confirmed with the author:

| Topic                                   | Decision                                                                                                                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where instances of a new type live      | **Static catalog file**: `data/catalogs/<plural>.ts` exporting `races = { elf: {…} } satisfies Record<string, TRace>`, plus `TRaceId = keyof typeof races`. Not in `register`, not in `TWorldState`. |
| How a property typed by a type is stored | **Id string**: the type is written as `race: TRaceId` and the value as `race: 'elf'`, the same way `location: TLocationId` works today.                                                         |
| A new required field on a type that has instances | **Fill defaults**: the same write adds a default value to every instance and reports the touched files.                                                                         |
| How far the inputs reach                | **Phased**: Entities first, then ChapterInfoForm and the passage editor, then the old components are deleted.                                                                            |
| Per-entity data type (`TAnnieCharacterData`) | **It is a type**: edited with `StructureInput`. `init` stays a value, edited with `ObjectInput` whose fields come from `TCharacterData` plus that data type (Q1).                     |
| Item props                              | **No per-type structure**: an item has required fields (`name`, `type`) and then free-form `{ key: value }` props (Q2).                                                                 |
| Literal location                        | **Global or local**: shared literals live in `types/literals.ts`. A literal can also be local, declared in the file that uses it (e.g. `TItemType` in `data/items/itemInfo.ts`).          |
| Creating literal values                 | **From the input**: `LiteralInput` is an Autocomplete. A value that matches nothing offers "+ Add `x` to `TItemType`", which writes the value to the literal's file.                    |
| Chapters                                | **Not extendable** (Q3). `TChapter` stays a read-only engine type.                                                                                                                       |
| Deleting a referenced instance          | **Clear the references** (Q4, Q5), for catalog entries and built-in entities alike, see 5.1. Only references in code still block a delete.                                                                                                                         |

My assumptions (flag any that are wrong):

- **A1.** Literal unions are string-only (`'a' | 'b'`). Number or mixed unions are shown read-only as code. `T*Id` unions (e.g. the generated `TVillageThomasPassageId`) are ids, not literals, and are skipped.
- **A2.** The Structure tab does not edit engine types (`TChapter`, `TPassage*`, `TLink`, `TTimeTrigger`, `TItem`, `ids.ts`). It lists them read-only. (Confirmed by Q3.)
- **A3.** The **extendable** types are `TCharacter`, `TCharacterData`, `TNpc`, `TNpcData`, `TLocation` and `TItemInfo` (3.1). Their engine fields are locked. The user can add, edit and remove only their own fields. (Confirmed by Q3.)
- **A4.** Nested object types are edited inline as anonymous `{ … }` types. Splitting a nested type into its own named type is a manual action ("Extract to type"), out of scope for v1.
- **A5.** Existing user stories (`stories/*`, git-ignored) are migrated by an idempotent server-side migration when a story is first opened. The example story and `server/template` are migrated by hand and committed.
- **A6.** Non-object inputs never edit code. If a value is already code (`_('…')`, an expression), the input shows it read-only, with **Convert to value** when it parses and **Reset** otherwise. This generalises today's `PlainTextInput` / D9 behaviour. `FunctionInput` stays code-based, because a function is code.

---

## 1. Shared type model (protocol)

New file `Visualizer/protocol/src/dto/structure.ts`. Both sides use it: the server parses `types/*.ts` into it, and the client renders inputs from it.

```ts
export type TTypeRef =
    | { t: 'string' }
    | { t: 'number' }
    | { t: 'boolean' }
    | { t: 'literal'; name: string }               // TItemType → LiteralInput
    | { t: 'ref'; name: string }                   // TRace / TLocation → TypeInput, value is an id
    | { t: 'array'; of: TTypeRef }
    | { t: 'object'; fields: TFieldDesc[] }        // inline { … }
    | { t: 'function'; signature: string }         // '() => void'
    | { t: 'code'; code: string };                 // anything else, read-only

export type TFieldDesc = {
    key: string;
    type: TTypeRef;
    optional: boolean;
    locked?: boolean;          // engine field, cannot be edited or removed
    description?: string;      // JSDoc
};

export type TLiteralScope = 'global' | 'local';   // types/literals.ts | declared in the file that uses it

export type TLiteralDto = TVersioned & TSourceRef & { name: string; scope: TLiteralScope; values: string[] };

export type TTypeOrigin = 'story' | 'extendable' | 'engine';

export type TStructTypeDto = TVersioned & TSourceRef & {
    name: string;
    origin: TTypeOrigin;
    fields: TFieldDesc[];      // empty for 'engine'
    code?: string;             // read-only source for 'engine' / unparsable
    catalog?: { name: string; file: string; idType: string };  // races, data/catalogs/races.ts, TRaceId
};

export type TStructureDto = TVersioned & { literals: TLiteralDto[]; types: TStructTypeDto[] };
```

Bodies: `TCreateTypeBody { name; fields; catalog?: { name } }`, `TUpdateTypeBody { version; fields; renames?: Record<string,string>; resetIncompatible?: boolean }`, `TCreateLiteralBody { name; values; file?: string }` (no `file` → global, in `types/literals.ts`; with `file` → local, declared in that file), `TUpdateLiteralBody { version; values; renames?: Record<string,string> }`, `TAddLiteralValueBody { value }` (the `LiteralInput` "+ Add" path: appends one value, no version needed since it only adds), `TDeleteBody`.

A literal's name is unique across the whole story, global and local alike, so `literal(name)` never needs a file to resolve.

How a ref maps to an id list (`refTargets`):

| `ref.name`      | written as      | ids from                           |
| --------------- | --------------- | ---------------------------------- |
| `TLocation`     | `TLocationId`   | entities `locations`               |
| `TItem`         | `TItemId`       | entities `items`                   |
| `TCharacter`    | `TCharacterId`  | entities `characters`              |
| `TNpc`          | `TNpcId`        | entities `npcs`                    |
| `TChapter`      | `TChapterId`    | project chapters                   |
| a catalog type  | `T<Name>Id`     | catalog `<plural>`                 |

Also add `typeDefault(ref, structure)` to protocol (`dto/structure.ts` or `structureDefaults.ts`). Both sides need it: the server fills defaults, the client creates new rows. It returns `''`, `0`, `false`, the first literal value, the first id (or `''`), `[]`, an object of the required fields' defaults, and `{ code: '() => {}' }` for a function.

---

## 2. Phase 1: input components (client only)

### 2.1 Folder layout

```
Visualizer/client/src/components/inputs/
  BooleanInput.tsx        checkbox
  StringInput.tsx         single (input:text) | multiline (textarea)
  NumberInput.tsx         keeps text while typing (logic from Entities/inputs.tsx)
  LiteralInput.tsx        MUI Autocomplete, options = literal values, optional "+ Add" for a new value
  TypeInput.tsx           MUI Autocomplete over ids of a ref type, shows "id — name"
  ArrayInput.tsx          add / move up / move down / remove, item type optional
  ObjectInput/
    ObjectInput.tsx       view toggle (inputs ⇄ code), structure-aware
    ObjectFieldsView.tsx  one row per field
    ObjectCodeView.tsx    CodeTextArea + validation messages
    AddFieldRow.tsx       custom key + type picker
    objectValidation.ts   parse code → TValueRecord, check against TFieldDesc[]
  StructureInput/
    StructureInput.tsx    edits TFieldDesc[] (Structure tab, entity data types)
    FieldTypePicker.tsx   string/number/boolean/literal/ref/array/object/function
  ValueInput.tsx          dispatches a TTypeRef to the right pure input (recursion point)
  FunctionInput.tsx       moved from components/, label removed
  ImageInput.tsx          moved from components/ (its label becomes the FormLabel)
  CodeTextArea.tsx        extracted from CodeField.tsx (Tab inserts spaces)
  CodeValue.tsx           read-only code + Convert / Reset (A6), from PlainTextInput
  InputDiagnostics.tsx    extracted FieldDiagnostics
  codeLiterals.ts         moved from components/
  valueSource.ts          valueToSource / parseValueSource (from Entities/entityFields.ts), extended to arrays and objects
  form/
    FormLabel.tsx
    FormBooleanInput.tsx  FormStringInput.tsx  FormNumberInput.tsx  FormLiteralInput.tsx
    FormTypeInput.tsx     FormArrayInput.tsx   FormObjectInput.tsx  FormFunctionInput.tsx
    FormStructureInput.tsx  FormValueInput.tsx
  __tests__/
```

Notes:

- The empty `components/inputs/__tests__/` folder already exists.
- `components/` keeps the non-input files: `ResizableSplitter`, `SourceEditorDialog`/`Store`, `openSourceEditor`.
- The spec says `BooleanInput.ts`. These are `.tsx`, since they render JSX.

### 2.2 Contracts

Pure inputs have no label, no diagnostics list, and no add/remove logic:

```ts
type TInputProps<T> = {
    value: T;
    onChange: (value: T) => void;
    hasError?: boolean;
    disabled?: boolean;
    ariaLabel: string;          // required: the label is gone, a11y still needs it
    dataField?: string;
};
```

- Scalar inputs take `TMaybeCode<T>`. A code value renders `CodeValue` (A6).
- `LiteralInput` adds `options: string[]` and `onCreateOption?: (value: string) => Promise<boolean>`.
  - Without `onCreateOption`, only the options can be picked.
  - With it, typed text that matches no option shows a last row "+ Add `x`" (MUI `filterOptions`, as in the creatable Autocomplete pattern). Picking it calls `onCreateOption`. On `true`, the input sets the value. On `false` (the write was refused), it keeps the old value.
  - The new value is checked like a literal member: not empty, not already present (case-sensitive).
  - `ValueInput` wires `onCreateOption` to `StructureStore.addLiteralValue(name, value)`.
- `TypeInput` adds `options: TOption[]`, where `TOption` is `{ id, label? }` and comes from `EntityStore`.
- `ArrayInput` adds `itemType?: TTypeRef` and `renderItem?`. Without `itemType`, it infers each item's type from the value.
- `ObjectInput` adds `fields?: TFieldDesc[]`, `allowCustomFields?: boolean` (default: `!fields`), and `diagnosticsOf?: (path) => TDiagnosticDto[]`.

Form variants are `FormLabel` plus the pure input:

```ts
type TFormProps = {
    label: string;
    diagnostics?: TDiagnosticDto[];
    optional?: boolean;           // "+ label" when undefined, × remove when set
    actions?: ReactNode;          // extra header buttons (e.g. ObjectInput's view toggle)
    helperText?: string;
};
```

`FormLabel` layout:

- The form root sets `container-type: inline-size`.
- `@container (min-width: 560px)` gives a two-column grid (`label 160px | input 1fr`), with the label aligned to the first line of the input.
- Below that width, the label sits above the input as today's caption (`FieldLabel` style).
- `FormLabel` also renders `InputDiagnostics`, the optional add/remove, and `actions`. Its error colour replaces `FieldLabel`, which is deleted.

### 2.3 `ValueInput` (the recursion point)

`ValueInput({ type, value, onChange, … })` switches on `type.t`:

| `type.t`             | renders                                                      |
| -------------------- | ------------------------------------------------------------ |
| `string`             | `StringInput`                                                |
| `number`             | `NumberInput`                                                |
| `boolean`            | `BooleanInput`                                               |
| `literal`            | `LiteralInput` with options from `StructureStore`, creatable |
| `ref`                | `TypeInput` with ids from `EntityStore`                      |
| `array`              | `ArrayInput`                                                 |
| `object`             | `ObjectInput`                                                |
| `function`           | `FunctionInput`                                              |
| `code`               | `CodeValue`                                                  |

The stores reach `ValueInput` through one `StructureContext` (`createSafeContext` from `@story/ui`). The pure inputs don't import the stores.

### 2.4 `ObjectInput` details

- **Toggle.** A ToggleButtonGroup (inputs ⇄ code), styled like `FunctionInput`.
  - Inputs → code serialises with `valueSource.valueToSource`.
  - Code → inputs needs `parseValueSource` to succeed. If it fails, the button is disabled and its tooltip says why. The last literal is remembered so the round trip doesn't lose it (as `MaybeCodeField` does today).
- **Code validation** (`objectValidation.ts`), shown live under the textarea:
  1. Parse errors (unbalanced brackets, not an object literal).
  2. With `fields`: missing required keys, unknown keys, and values whose literal type does not match (a string in a number field, a value outside a literal's list, an unknown id).
  3. Nested expressions (`_('…')`, calls) are accepted as code and not checked.

  The server's type check stays the source of truth on Save. Its diagnostics map back by field path (`init.health`).
- **Inputs view.**
  - Each present field is a `FormValueInput` row.
  - A missing optional field shows as a small `+ key` chip. A present optional field gets ×.
  - Locked fields cannot be removed.
- **No structure** (or `allowCustomFields`): `AddFieldRow` takes a key, checked as an identifier and unique (logic from `RecordEditor`), and a type from `FieldTypePicker`. It inserts `typeDefault(type)`. The type of an existing custom value is inferred from the value (`inferTypeRef`). A value that is code becomes `{ t: 'code' }`.
- **Unknown keys with a structure** render with a warning style and a remove button, not silently as code.

### 2.5 `ArrayInput`

- Each row is `ValueInput(itemType)` with ↑ / ↓ / × buttons. Drag and drop is a later nicety. Keys are stable per row, from an index map kept in a ref, so focus survives a move.
- **Add** appends `typeDefault(itemType)`.
- `minItems` / `maxItems` are not needed in v1.
- The inventory (`TItemPartial[]`) becomes an `ArrayInput` of `object { id: ref TItem, amount?: number }`. That replaces `InventoryField`.

### 2.6 `StructureInput`

- Each row: key (identifier), `FieldTypePicker`, optional toggle, description (collapsible), ↑/↓, ×.
- `locked` rows are greyed out and read-only, with a lock icon and a tooltip saying "Used by the engine".
- `FieldTypePicker` is a select of primitives, `literal → <Autocomplete of literal names>`, `ref → <Autocomplete of struct type names>`, `array of → <nested picker>`, `object → <nested StructureInput>`, and `function`.
  - The literal Autocomplete lists global literals and the local literals of the file being edited, grouped ("Global" / "This file").
  - A name that matches nothing offers "+ New local literal `TX`". It opens a small inline editor for the first values. The literal is created in the same file as the type on Save, together with the type change (one `EditSession`).
  - Promoting a local literal to global ("Move to literals.ts") is a later nicety, not v1.
- Field renames are tracked: the original key is kept per row, so Save can send `renames` and the server can rename values in instances.

### 2.7 Tests (jsdom, `components/inputs/__tests__/`)

- Port `FunctionInput.test.tsx` and `ImageInput.test.tsx`.
- New tests:
  - `NumberInput`: partial text.
  - `LiteralInput` / `TypeInput`: options, value outside the options.
  - `LiteralInput`: "+ Add" shown only for a non-matching value and only with `onCreateOption`; a refused create keeps the old value.
  - `ArrayInput`: add, move, remove.
  - `ObjectInput`: toggle round trip, code that does not parse, validation against fields, custom field add.
  - `StructureInput`: locked row, rename tracking.
  - `FormLabel`: optional add/remove.
  - `objectValidation` / `valueSource`: unit tests.

---

## 3. Phase 2: story type layout and the server's structure reader

### 3.1 New story layout (example story + `server/template`)

```
types/
  literals.ts       global literals shared across files (empty at first: the example has none yet)
  TCharacter.ts     TCharacter, TCharacterData
  TNpc.ts           TNpc, TNpcData                       (split out of TCharacter.ts)
  TItem.ts          + TInitInventory (shared by TCharacter / TNpc, now exported)
  TLocation.ts, TChapter.ts, TPassage.ts, TTimeTrigger.ts, ids.ts   (unchanged)
  TRace.ts          (user type, created by the Structure tab) TRace + TRaceId
  index.ts          barrel; the writer adds/removes `export * from './TRace'`
data/
  catalogs/races.ts export const races = { elf: { name: 'Elf' } } satisfies Record<string, TRace>;
  items/itemInfo.ts keeps TItemType as a local literal; gains `TItemInfo` (see below)
```

Items (Q2). The required fields of every item are one exported type in `data/items/itemInfo.ts`, next to the local `TItemType`:

```ts
export type TItemType = 'value' | 'resource' | 'tool' | 'food' | 'weapon';
export type TItemInfo = { name: string; type: TItemType };
```

- `itemInfo`, `foodInfo` and `toolInfo` check their entries with `satisfies Record<string, TItemInfo & Record<string, unknown>>`. That replaces the three `Object.values(…).forEach((item: TItemInfo) => …)` checks and their local `TItemInfo` copies. `as const` stays, so `TItem` still sees the exact props.
- `foodInfo` / `toolInfo` import `TItemInfo` from `./itemInfo` with `import type`, so the runtime `itemInfo → foodInfo` import does not become a cycle.
- `TItemInfo` is an **extendable** type, like `TCharacter`: `name` and `type` are locked; the user can add required fields shared by all items. Everything else on an item is a free-form prop.

`TRace.ts`:

```ts
import type { races } from '@story/data/catalogs/races';
export type TRace = { name: string; strength: number };
export type TRaceId = keyof typeof races;
```

This is the same type-only `types ⇄ data` cycle as `TItemId`, which `data/index.ts` already documents.

### 3.2 Reader `server/src/project/readers/structure.ts`

- `readLiterals(sp)`:
  - Each `export type X = 'a' | 'b'` in `types/literals.ts` becomes a `TLiteralDto` with `scope: 'global'`.
  - Each string-literal union alias in any other `types/*.ts` or `data/**/*.ts` file becomes `scope: 'local'`, with that file as its source. Names matching `T*Id` are skipped (A1).
  - A non-string union becomes a `code` type (A1).
  - Two literals with the same name are reported as a diagnostic on the structure, and the second is ignored.
- `readTypes(sp)`: walks every `types/*.ts` type alias.
  - `ENGINE_TYPES` (TChapter, TPassage…, TLink, TLinkCost, TTimeTrigger, TItem, TItemPartial, TInitInventory, ids) → `origin: 'engine'` with `code`.
  - `EXTENDABLE_FIELDS = { TCharacter: ['id','name','description','image','startPassageId','init'], TCharacterData: ['location','health','inventory'], TNpc: [...], TNpcData: [...], TLocation: [...], TItemInfo: ['name','type'] }` → `origin: 'extendable'`. The listed members are `locked`. `TItemInfo` is read from `data/items/itemInfo.ts`, not `types/`.
  - Everything else that is a non-generic object type → `origin: 'story'`.
  - `typeNodeToRef(node)`:
    - keywords → primitives
    - a literal alias name → `literal`
    - `T<Name>Id` with a known type → `ref`
    - `X[]` / `Array<X>` → `array`
    - a type literal → `object`
    - a function type → `function`
    - anything else → `code` (its text, so it round-trips verbatim)
  - JSDoc → `description`.
- The catalog is found by convention: `data/catalogs/*.ts` whose export `satisfies Record<string, TName>`.
- The entity data types (`T<Id>CharacterData` in entity files) are read with the same `typeNodeToRef`. `TDataTypeDto` gains `fields?: TFieldDesc[]` next to `code`, so the Entities form can use `StructureInput` / `ObjectInput`.

### 3.3 Field schemas from structure

- Today `entityFields(sp, kind)` / `CHARACTER_INIT` / `NPC_INIT` / `ITEM_TYPE_PROPS` hard-code the fields. `ITEM_TYPE_PROPS` is dropped, not replaced: item props are free-form (Q2). Add `schemaOf(ref): TSchema` in `values.ts` to map `TTypeRef` → the existing `S.*` schema (`literal` → `S.string`, `ref` → `S.ref(resolver)`), so user fields read and write with the same machinery.
- `entityFields` appends the user fields of `TCharacter` / `TNpc` / `TLocation`.
- `NEW_ENTITY.text` adds `typeDefault`s for the user's required fields to new entity files, so creating an entity still type-checks after the user has added `energy: number`.

### 3.4 Migration `server/src/project/migrations/structureLayout.ts`

Idempotent. It runs once per `SourceProject` on the first `run()`, as an `EditSession` (formatted and type-checked; on new diagnostics it logs and leaves the files alone):

1. If `types/literals.ts` is missing: create it empty and add it to `types/index.ts`. Existing literals stay where they are and are read as local. Nothing is moved.
2. If `TNpc` / `TNpcData` are declared in `TCharacter.ts`: move them to `TNpc.ts`, export `TInitInventory` from `TItem.ts`, and update `index.ts`.
3. If `data/items/itemInfo.ts` has no exported `TItemInfo`: add it, switch the three item files to `satisfies` (3.1), and remove the local `TItemInfo` copies and `forEach` checks. Item files that don't match the expected shape are left alone and logged.
4. If `data/catalogs/` is missing: create nothing (lazy).

Tests: run it on a copy of the pre-migration example story. The second run is a no-op. `tsc` is clean before and after.

### 3.5 Routes (read-only in this phase)

`getStructure: GET /structure` → `TStructureDto`. `pathToEvent` maps `types/**` and `data/catalogs/**` to a new `structure` change event (and to `catalog/<name>/<id>` for catalog files).

---

## 4. Phase 3: stores, and Entities moved onto the new inputs

### 4.1 `client/src/stores/StructureStore.ts` (app-wide)

- State: `structure: TStructureDto | null`, `loading`, `error`.
- `load()` and `start()`: subscribes to `structure` events and to resync.
- Getters:
  - `literal(name)`, `literalNames`, `literalsVisibleFrom(file)` (globals plus that file's locals)
  - `type(name)`, `storyTypes`, `extendableTypes`, `engineTypes`
  - `refTypeNames` (types that can be referenced: built-ins plus catalog types)
  - `fieldsOf(typeName)`, which merges a base type with an entity's data type, e.g. `TCharacterData` & `TAnnieCharacterData`
- Mutations (`createType`, `updateType`, `deleteType`, `createLiteral`, `updateLiteral`, `addLiteralValue`, `deleteLiteral`) return `{ ok } | { diagnostics } | { references } | { stale }`, so the page shows them.

### 4.2 `client/src/stores/EntityStore.ts` (app-wide)

This is the data half of today's `EntitiesStore`:

- `lists` per kind, including catalogs (`catalog:races`)
- `loadList`, `create`, `update`, `remove`
- event subscription and `refreshAll`
- `idsOf(kind)`, `optionsOf(ref: TTypeRef): TOption[]` (feeds `TypeInput`)
- the `project` cache

The form half stays in `pages/Entities/EntityFormStore.ts`: selection, draft, base, stale, persisted drafts, save/discard/keepMine.

Both stores are created in `context.ts` next to the existing singletons and provided through `StructureContext`.

> If the Structure editor's draft/stale logic ends up a near-copy of `EntityFormStore`'s, extract `DraftResource<T>` (base, draft, stale, dirty, save, discard, keepMine) into `stores/`. Chapter editing has the same pattern, so that makes three users.

### 4.3 Entity form on the new inputs

| Field                          | Before                          | After                                                            |
| ------------------------------ | ------------------------------- | ---------------------------------------------------------------- |
| name / description / mapId     | `StringField` (code toggle)     | `FormStringInput` (code → `CodeValue`)                           |
| startPassageId                 | `IdField`                       | `FormTypeInput` (options = passage ids)                          |
| init                           | `MaybeCodeField` + `RecordEditor` | `FormObjectInput` with `fields = fieldsOf('TCharacterData') + own data type` |
| inventory                      | `InventoryField`                | `ArrayInput` of `{ id: ref TItem, amount?: number }` (inside init) |
| localCharacters                | `LocalCharactersField`          | `FormArrayInput` of `object { name: string, description: string }` |
| sublocations                   | `IdMultiPicker`                 | `FormArrayInput` of `ref TLocation`                              |
| data type `T<Id>CharacterData` | `CodeOnlyField`                 | `FormStructureInput` (Q1)                                        |
| item name / type               | `StringField` + hard-coded `ITEM_TYPES` select | `FormObjectInput` with `fields = fieldsOf('TItemInfo')` and `allowCustomFields`; `type` is a creatable `LiteralInput` over `TItemType` (Q2) |
| item props                     | `RecordEditor` + `ITEM_TYPE_PROPS` | the custom fields of that same `FormObjectInput`: free `{ key: value }`, type inferred per value |
| user fields of TCharacter etc. | (none)                          | `FormValueInput` per field from `StructureStore`                 |

Remove `Entities/CodeField.tsx`, `Entities/inputs.tsx`, and `CHARACTER_INIT`/`NPC_INIT`/`ITEM_TYPES`/`ITEM_TYPE_PROPS`/`itemCreateProps`. `itemSourceForType` stays: food goes to foodInfo, tool to toolInfo, every other value (including a newly added one) to itemInfo.

`CreateEntityDialog` for items asks only for id, name and type (the creatable `LiteralInput`). Props are added afterwards in the form. Changing `type` to `food` / `tool` moves the entry between files as today.

---

## 5. Phase 4: Structure tab

### 5.1 Server writers `server/src/project/writers/structure.ts`

- **createType** `{ name, fields, catalog? }`:
  - Validate the name (`^T[A-Z][A-Za-z0-9]*$`, unique across literals and types; reserved: engine names, `T*Id`).
  - Create `types/<Name>.ts` and add `export *` to `types/index.ts`.
  - If `catalog`, create `data/catalogs/<plural>.ts` (`export const <plural> = {} satisfies Record<string, T<Name>>;`) and add `T<Name>Id` to the type file. The plural defaults to an English rule and the user can edit it in the create dialog.
- **updateType** `{ version, fields, renames?, resetIncompatible? }`:
  - Story types: regenerate the type literal from `fields` (`refToTypeText`). A field typed `code` keeps its original text.
  - Extendable types: keep locked members' text verbatim, then add, replace or remove only the user members.
  - In the same session, for every instance (catalog entries, entity objects, or `init` objects for `*Data` types):
    - apply `renames`
    - remove deleted keys (excess-property errors would otherwise block the save)
    - add `typeDefault` for new required keys (decision: fill defaults)
    - if `resetIncompatible`, replace values of fields whose type changed
  - The commit's type check refuses anything still broken and returns diagnostics. The client then offers "Reset incompatible values".
  - The response lists the touched files, so the UI can say "Updated 3 characters".
- **deleteType**: refused with references while anything uses it (`findImportReferences` + diagnostics, as in `deleteEntity`). It also deletes the empty catalog and the barrel line. Extendable and engine types cannot be deleted.
- **Literals** (create / update / addValue / delete) edit the literal's own file: `types/literals.ts` for a global one, the declaring file for a local one.
  - `createLiteral` with `file` inserts the alias after that file's imports. The name check is the same as for types and covers every literal in the story.
  - `addLiteralValue` appends one value, in its own `EditSession`. It is the only write the entity form makes outside its own entity, so it commits immediately, independent of the form's draft: discarding the form keeps the value (Q6). It emits `structure`.
  - `renames` rewrite matching string literals at positions typed by that literal (found through the type checker on property assignments). Removing a value that is still used is refused, with references.
  - `deleteLiteral` is refused while the literal is referenced, as for types.
- **Catalog entries**:
  - CRUD under `/catalogs/:name/:id`.
  - DTO `TCatalogEntryDto = TVersioned & TSourceRef & { kind: 'catalog'; catalog: string; type: string; id: string; values: TValueRecord }`.
  - Implemented like items: properties of one object. Factor the shared "object-of-objects" helpers out of `readers/entities.ts` (`itemNodes` / `findItem` / `itemText`) into `project/objectCatalog.ts` instead of copying them. Items could become a catalog later, but not in this refactor.
  - Delete clears references, see **Reference clearing** below.
- **Reference clearing (Q4, Q5)** `project/clearReferences.ts`. Shared by `deleteCatalogEntry` and `deleteEntity`, so a race, a location or an item is handled the same way.
  - `findValueReferences(sp, ref, id)` uses the field descriptors from `readTypes` to find every value typed `ref` to the deleted kind. It looks in catalog entries, entity objects, `init` objects, chapter `init`, `sublocations` and inventories.
  - `clearValueReferences(s, refs)` runs in the same `EditSession` as the removal:
    - optional field → the key is removed
    - array item (`sublocations`, an inventory entry `{ id: 'axe' }`) → the element is removed
    - required field (`location` in `TCharacterData`) → set to `typeDefault`, i.e. the first remaining id
    - required field and no ids remain → the delete is refused with references, since there is nothing valid to put there
  - **Code references still refuse the delete**, because there is no value to clear:
    - imports of the entity file (`findImportReferences`)
    - a character's chapter files (`chapterCharacterFiles`)
    - ids used inside code (`race: pickRace()`, `inventory.add('axe')` in a passage)

    `deleteEntity` keeps its `findImportReferences` / chapter-file check up front, but no longer counts value references there. Code mentions that remain show up in the commit's type check and come back as references (`diagnosticsAsReferences`), as today.
  - The response becomes `{ ok: true; cleared: TReferenceDto[] }` ("Cleared location on 2 characters, removed from 1 inventory"). `EntityFormStore` and the catalog form show it as a notice after the delete. The other events (`entity/...` for each touched entity) are emitted so open forms go stale correctly.
  - The delete confirmation dialog shows a preview from `GET /entities/:kind/:id/references` (value references that will be cleared, plus blocking code references). This replaces today's "refused" round trip as the first thing the user sees.
- Events: `structure` for types and literals, `catalog/<name>/<id>` for entries.

### 5.2 Client page `client/src/pages/Structure/`

- Router: `{ page: 'structure'; section?: 'types' | 'literals'; name?: string }`, with hashes `#/structure`, `#/structure/types/TRace`, `#/structure/literals/TItemType`. Enable the existing disabled tab in `TopBar.tsx`. Add a `router.test.ts` case.
- Files:
  - `StructurePage.tsx`: the layout (list | editor, same splitter as Entities).
  - `StructureList.tsx`, grouped into **Literals**, **Story types**, **Engine types (extendable)** and **Engine types (read-only)**, each with "+ New".
  - `LiteralEditor.tsx`: values as editable chips (add, rename in place, remove, reorder), a usage count, and the scope ("Global" or "Local to `data/items/itemInfo.ts`").
  - The **Literals** group lists global and local literals, local ones with their file as secondary text.
  - `TypeEditor.tsx`: name and file, `StructureInput`, a catalog link ("12 races → open in Entities"), Save/Discard/Delete, and notices (diagnostics, references, stale) through a shared `Notices` component. Generalise `Entities/Notices.tsx` to take a store interface.
  - `CreateTypeDialog.tsx` (name, "has instances (catalog)" switch on by default, plural) and `CreateLiteralDialog.tsx` (name, values, scope: global or local to a picked file).
  - `StructureEditorStore.ts`: selection, draft, stale. It uses `DraftResource` if that was extracted.
- Entities kind menu: the built-in kinds plus one entry per catalog. The catalog entry form is `FormObjectInput` with `fields = type.fields`, plus id and Create/Delete.

### 5.3 Mock API

Extend `mockApi.ts` / `mockData.ts` with a structure (the example's types and literals, plus a `TRace` catalog), so `VITE_VISUALIZER_API=mock` covers the new tab.

---

## 6. Phase 5: the rest of the Visualizer, then cleanup

1. `ChapterInfoForm`: title and description → `FormStringInput`; location → `FormTypeInput(ref TLocation)`; init → `FormObjectInput` with `fieldsOf` the chapter data type; time range stays a dedicated input (it is `Time.fromString` code).
2. The passage editor (`ScreenFields`, `LinearFields`, `TransitionFields`, `LinkEditor`, `BodyItemEditor`, `CostField`, `ExecuteField`): `PlainTextField` → `FormStringInput`, `IdCodeField` → `FormTypeInput`, `NumberCodeField` → `FormNumberInput`, `BooleanCodeField` → `FormBooleanInput`, `FunctionInput` → `FormFunctionInput`. Cost items → `ArrayInput`.
3. Timeline `TriggerModal` / `AddModal` and Map `LocationForm` (`TextDraftField`, `SourceField`), wherever they edit values.
4. Delete `components/CodeField.tsx`, `PlainTextField.tsx`, `FieldLabel.tsx`, `fieldLayout.ts`, and the old `components/FunctionInput.tsx` / `ImageInput.tsx` locations. `grep` must show no imports left.
5. Docs:
   - `docs/Visualizer.md`: client components section, Pages → Structure (remove "User-defined entity kinds are out of scope"), story file conventions (literals.ts, TNpc.ts, catalogs), and API routes.
   - `Visualizer/README.md`, if routes are listed there.

---

## 7. Order of work and checkpoints

| #   | Step                                                                 | Done when                                                               |
| --- | -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | Protocol `dto/structure.ts` and `typeDefault`                        | Types compile, unit tests for defaults                                  |
| 2   | Phase 1 inputs and `form/`                                           | Input tests pass, inputs render in the `_canvas` playground or mock mode |
| 3   | Example + template migrated by hand (literals.ts, TNpc.ts, TItemInfo) | `yarn typecheck-stories`, engine tests and SingleEngine run             |
| 4   | Server structure reader and `GET /structure`, migration              | Reader and migration tests on a temp copy                               |
| 5   | `StructureStore`, `EntityStore`, `EntityFormStore` split             | Ported `EntitiesStore` tests pass                                       |
| 6   | Entities on the new inputs                                           | Manual check of all four kinds (mock + real), Ctrl+S, drafts, stale     |
| 7   | Structure writers (types, literals, defaults/renames/removals)       | Server tests: add a required field → defaults filled; rename; delete refused |
| 8   | Structure tab UI                                                     | Create `TRace` → add `race: TRace` to TCharacter → pick a race on a character |
| 9   | Catalog entries (server + Entities menu), `clearReferences` shared with `deleteEntity` | CRUD tests, event round trip; deleting a used race / location / item clears optional and array refs, defaults required ones, refuses when no id remains or a code reference exists |
| 10  | Phase 5 migration of the other forms, then delete the old components | No imports of the old files, all tests green                            |
| 11  | Docs                                                                 |                                                                         |

Every step stays shippable. The old components keep working until step 10.

---

## 8. Risks

- **Rewriting types with ts-morph.** Generic or conditional types (`TCharacter<Ch>`, `TItem`'s `DeepWriteable`) must never be regenerated. Only user members of extendable types are touched, and locked member text is kept byte-for-byte. A test asserts this.
- **Type-check cost.** Each structure save type-checks the whole story, and filling defaults can touch many files. That is acceptable at the current story size. Watch it.
- **The type-only cycle** `types ⇄ data/catalogs`. It must stay `import type`. The writer only generates `import type`.
- **Local literal discovery.** Scanning `data/**` for string unions can catch aliases that are not meant as literals. The `T*Id` skip handles the generated passage ids. If more false positives show up, restrict local literals to aliases that a field of a known type actually uses.
- **Silent edits on delete.** Clearing references can change several entities at once, and a required field falls back to an arbitrary first id. The confirmation preview and the `cleared` notice must name every touched entity and the new value, so nothing changes unseen.
- **Literal renames** need the type checker to find the usages. If that proves fragile, v1 refuses a rename of a used value, with references, and the user edits by hand.

---

## 9. Resolved questions

- **Q1.** (b): the per-entity data type is a type and is edited with `StructureInput`. `init` is the value and uses `ObjectInput` over `TCharacterData` plus that data type.
- **Q2.** No per-item-type structure. An item has required fields (`TItemInfo`: `name`, `type`) and then free `{ key: value }` props. `TItemType` stays a local literal in `itemInfo.ts`, and new values can be added from the item form.
- **Q3.** Chapters are not extendable.
- **Q4.** Deleting a referenced instance clears the references (5.1).
- **Q5.** The same applies to built-in entities (locations, items, characters, NPCs). Code references still block a delete (5.1).
- **Q6.** "+ Add" in `LiteralInput` writes the new value at once. Discarding the form keeps it.

