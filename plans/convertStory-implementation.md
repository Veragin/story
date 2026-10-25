# Implementation plan: Engine settings + demo story

Source: `plans/convertStory.md`. Two parts that depend on each other. Part A gives stories an `onLinkClick` hook and a custom `Topbar` component, each with an author-written description. Part B converts `tmp/demo-story` into `stories/demo`, which uses both.

## Decisions

- **`topbar` is a real TSX component.** It replaces the **stats area** of the status bar.
- **The description is the main input.** Usually the author describes the setting in plain words, and the code comes later. For now a person writes it. Later an AI agent on the server will write it (not part of this plan; see "Prepared for the AI agent").
    - The description is stored as the JSDoc of the setting's export.
    - It can be saved without any code.
- **All MUI icons can be imported.** The larger player bundle is accepted.
- **`onLinkClick` runs for every link that is taken**: player clicks and choices the engine makes for engine-played characters.
- **The stat stays `stamina`.** The topbar shows it as "Stamina", with the bolt icon.
- **Production doesn't exist yet.** The demo is seeded like the example (fresh database or dev) and there is no migration for existing installs.

## Key constraints (found in the codebase)

- **Story code today is `.ts` only.** Only `@story/shared` and `@story/core` can be imported (`HOST_MODULES`, `clients/SinglePlayer/src/worldState.ts:7`).
    - Sucrase only strips types (`clients/shared/storyLoader/src/transpile.ts:26`).
    - The resolver and the play manifest accept `.ts` and `.png` only (`storyLoader/src/resolve.ts`, `server/src/play/playFiles.ts:12-15`).
    - `SourceProject.isStoryFile` and `assertEditable` (`server/src/project/writers/source.ts`) only allow `.ts`.
    - Already in place: `tsconfig.base.json` has `"jsx": "react-jsx"` and the server's ts-morph project has `jsx: ReactJSX`. Typechecking `.tsx` story files already works.
- **The engine only receives `register` and `itemInfo`.** `TStoryModule = { register, itemInfo }` and `isStoryModule.ts` checks only those two.
- **MultiEngine imports `@story/data` under plain node.** The Topbar must be loaded lazily, as passages are, so that node never imports React or TSX.
- **The body is evaluated before `execute` runs.** The passage function, and with it the body text, runs before `execute` (`clients/shared/core/src/engine/Processor.ts:36-37`). Building a passage must be pure (the example's `story.test.ts`).
- **`stories/*` is git-ignored except `stories/example`.** Seeding supports a single seed (`server/src/stories/importStoryFiles.ts`, `server/scripts/dev.ts`, `docker/prod-entrypoint.sh`, `docker/Dockerfile.prod:25`).

## Story-side shape

```
data/engine/
    index.ts        export const engine: TEngineSettings = { onLinkClick, Topbar: () => import('./Topbar') };
    onLinkClick.ts  /** <description> */ export const onLinkClick: TOnLinkClick = ({ link, characterId, time }, s, e) => { ... };
    Topbar.tsx      /** <description> */ export const Topbar = ({ s, e }: TTopbarProps) => <>...</>;
```

- Both files are optional. If `onLinkClick` is missing, no hook runs. If `Topbar` is missing, the default topbar (today's Health stat, `DefaultTopbar` in `@story/ui`) is shown.
- **Saving only a description** writes the file with that JSDoc and a stub implementation, so the story still plays:
    - `onLinkClick`: a no-op
    - `Topbar`: `export const Topbar = DefaultTopbar;`
    - The DTO's `implemented: false` marks the stub. The server recognises the stub by comparing the code with the known stub text.
- `Topbar` replaces the **stats area** of the status bar. The time, avatar and name, inventory and save/reset stay fixed, because the player must always be able to reach them.
- `Topbar` can import:
    - `react`
    - `@mui/material`
    - `@mui/icons-material`: the whole barrel. The loader maps the deep form `@mui/icons-material/Bolt` to the same icon, so snippets copied from the MUI docs work.
    - `@story/ui`, which gains `TopbarStat` (`icon`, `label`, `value`, tooltip) and `DefaultTopbar`

## Part A — Engine settings

### A1. Story types (template, example, demo)

Each story has its own `types/` copy, so apply this to `server/template/types`, `stories/example/types` and `stories/demo/types`.

- New `types/TEngine.ts`:
    ```ts
    export type TLinkClick = { link: TLink<TPassageId>; characterId: TCharacterId; time: DeltaTime; items: ...; tools: ... };
    export type TOnLinkClick = (click: TLinkClick, s: TWorldState, e: Engine) => void;
    export type TTopbarProps = { s: TWorldState; e: Engine };
    export type TEngineSettings = {
        onLinkClick?: TOnLinkClick;
        Topbar?: () => Promise<{ Topbar: (props: TTopbarProps) => ReactNode }>;
    };
    ```
    Export these from `types/index.ts`.
- Add `data/engine/index.ts` to the template and the example, exported from `data/index.ts` as `engine`.
    - The template gets an empty `engine = {}`.
    - The example gets a small `Topbar.tsx` that shows Health through `TopbarStat`. It serves as the reference.

### A2. Core engine (`clients/shared/core`)

- Extend `TStoryModule` with `engine?: TEngineSettings`. Pass it through `createWorldState`, `loadStory` (SinglePlayer `worldState.ts`) and MultiEngine. `isStoryModule` stays lenient, so older stories still load.
- Change `Story.goToPassage` to take the `TLink` instead of `(passageId, cost, onFinish)`. Before scheduling the turn it calls:
    ```ts
    const { characterId } = parsePassageId(link.passageId);
    const cost = this.e.processor.parseCost(link.cost);
    this.runOnLinkClick({ link, characterId, ...cost });
    ```
    - This covers both callers: `PassageLink.tsx:31` (a player click) and `Processor.autoProcess:84` (engine-played characters).
    - The hook runs inside `runInAction`. It runs before the next passage is built, so passage conditions see the updated stats.
    - Errors are caught and logged, and the player also gets a `showToast`. Navigation still goes ahead.
- Tests in `clients/shared/core/__tests__`:
    - the hook gets the link, the character and the parsed time
    - it runs for auto-processed characters too
    - it runs before the next passage is built
    - no hook means unchanged behaviour
    - a throwing hook still navigates

### A3. TSX support for story code

- `clients/shared/storyLoader`:
    - `transpile.ts`: for `.tsx` files, add `'jsx'` to the sucrase transforms, with `jsxRuntime: 'automatic'` and `production: true`.
    - `resolve.ts`: resolve `.tsx` next to `.ts`, both for extension-less imports and for `index`.
    - Update the README and its tests: a `.tsx` file compiles, and JSX in a `.ts` file is still an error.
- SinglePlayer `HOST_MODULES`: add `react`, `react/jsx-runtime`, `@mui/material`, `@mui/icons-material` and `@story/ui`.
- `StoryLoader`: support a host-module prefix rule. `@mui/icons-material/<Name>` resolves to `{ default: icons[Name] }`, and an unknown name is a `StoryLoaderError`. Add a test.
- Server:
    - `playFiles.ts`: serve `.tsx` (as `text/plain`, like `.ts`).
    - `storyFiles` and the manifest: include `.tsx`.
    - `SourceProject.isStoryFile`: accept `.tsx`.
- `storyTsconfig.ts`: check that the story tsconfig resolves `react` types from the repo `node_modules`. If not, add a `types` or `paths` entry. Then `migrateStoryTsconfig` rewrites existing stories.
- Standalone zip (`server/src/play/standalonePlayer.ts`) gets `.tsx` files through the manifest. Confirm this with a test.

### A4. SinglePlayer topbar

- `StatusBar.tsx` loads `e.storyModule.engine?.Topbar` once with a hook that is cached per story. It renders the component wrapped in `observer` and in an error boundary, and falls back to the default stats on error or while loading.
- `clients/shared/ui`, both exported from the barrel:
    - `components/TopbarStat/TopbarStat.tsx`: the old `SStat` styling (tooltip, icon, value)
    - `components/DefaultTopbar/DefaultTopbar.tsx`: today's Health stat, built with `TopbarStat`
- Tests in `__tests__/StatusBar.test.tsx`:
    - with no Topbar, the default is shown
    - a custom Topbar renders
    - it re-renders when `s` changes
    - a throwing Topbar falls back to the default

### A5. Protocol + server

- `protocol/src/dto/engine.ts`:
    ```ts
    TEngineSection = 'onLinkClick' | 'topbar';
    TEngineSectionDto = { section; file; exists: boolean; implemented: boolean; version: string; description: string; code: string };
    TUpdateEngineSectionBody = { version: string; description?: string; code?: string } | { version: string; delete: true };
    ```
    - `code` is the whole file text **without** the JSDoc on the primary export. `description` is that JSDoc text.
    - The server splits the two when reading and joins them when writing, so authors can import freely at the top of the file.
    - `description` and `code` are each optional in the update body. A client can change one without sending the other. For example, an agent writes code and leaves the author's description alone.
- `protocol/src/routes.ts`: `getEngineSection: GET /engine/:section (read)` and `updateEngineSection: PUT /engine/:section (write)`. Add them to `TApiSpec`.
- `protocol/src/dto/events.ts`: add `'engine'` to `RESOURCE_KINDS`. `server/src/events/pathToEvent.ts` maps `data/engine/**` to `{ kind: 'engine', id: section }`.
- Server:
    - `server/src/project/readers/engine.ts`: locate `data/engine/onLinkClick.ts` or `Topbar.tsx`, and read the JSDoc of the `onLinkClick` or `Topbar` export.
    - `server/src/project/writers/engine.ts`, reusing what `writers/source.ts` does:
        1. `assertCurrentVersion`
        2. `syntaxErrors` → 422 with line and column
        3. check that the file still exports the expected name → 422
        4. set the JSDoc, then `session.commit(bus, …)` with one `engine` event. The commit already type-checks new errors and returns a 422.
    - **Create:** when the file is missing, create it. With no `code`, it gets the stub from "Story-side shape". Also create or update `data/engine/index.ts`, plus `export * from './engine'` in `data/index.ts` for stories created before this change, all in the same session.
    - **Delete:** remove the file and its entry in `engine/index.ts`.
    - `server/src/editor/engine/EngineController.ts` and `EngineModule.ts`, registered in `AppModule.ts`, using `@ProtocolRoute`.
- Server tests in `server/__tests__/engineWrite.test.ts`:
    - read a missing section, then create it
    - save only a description, which writes the stub and returns `implemented: false`
    - update only the code, which keeps the description
    - update the code and the description, and check that the JSDoc is written
    - delete
    - 409 stale, 422 syntax, 422 type error, 422 missing export
    - a story without `data/engine/` gets it created

### A6. Visualizer — Engine tab

- **Router** (`shell/router.ts`):
    - route `{ page: 'engine'; section?: TEngineSection }`
    - `parseHash` and `routeToHash` cases
    - export from `shell/index.ts`
    - add cases to `shell/__tests__/router.test.ts`
- **Shell**: a `case 'engine'` in `shell/Shell.tsx`, and a tab `Engine` in `shell/TopBar.tsx`.
- **Shared left menu**: extract the column and list out of `pages/Structure/StructureList.tsx` into `components/SideMenu/SideMenu.tsx`.
    - Props: `groups: { title, entries: { name, secondary?, href, selected, unsaved? }[], onNew? }[]`, plus an optional `header` slot for the Types/Literals tabs.
    - `StructureList` becomes a thin adapter, and the Structure tests must still pass.
    - The Engine menu has one group, "Engine", with two entries. Each entry's `secondary` is the first line of its description, or "default" when the setting is missing. An entry with `implemented: false` gets a "not implemented" chip.
- **Code editor**: extract the CodeMirror part of `components/SourceEditorDialog.tsx` (with lint marks via `toCodeMirror`, `lintGutter`, Ctrl+S) into `components/CodeEditor/CodeEditor.tsx`.
    - It takes a `jsx` prop, which enables `javascript({ typescript: true, jsx: true })`.
    - `SourceEditorDialog` uses it too.
- **API**: `getEngineSection` and `updateEngineSection` in `api/types.ts`, `httpApi.ts` and `mockApi.ts`, with in-memory sections that emit `engine` events.
- **Store**: `pages/Engine/EngineEditorStore.ts`.
    - Holds `section`, plus a `DraftResource<TEngineSectionDto, { description; code }>` for the selected section.
    - Saves with `updateEngineSection`.
    - Handles `engine` events for the stale and external cases, like `StructureEditorStore`.
    - It's a module-level singleton, so drafts survive tab switches.
- **Page**: `pages/Engine/EnginePage.tsx` shows `SideMenu` on the left and `EngineSectionEditor.tsx` on the right. The editor has:
    - `FormPage`, `FormHeader` (save, discard, delete, Ctrl+S), `FormMeta` showing the file path, and `Notices` for stale, diagnostics and errors
    - **Description** comes first and is the main field: a large multiline `TextField`, with a placeholder example such as "Show health, stamina and hunger as icon + number".
    - **Implementation**: a `CodeEditor` below the description (`jsx` for `topbar`). It is collapsed while `implemented` is false, with an "Implement manually" button that expands it.
    - When the setting is missing, the starter code for the manual path is:
        - `onLinkClick`: `export const onLinkClick: TOnLinkClick = ({ link, characterId, time }, s, e) => {};`
        - `topbar`: a `Topbar` that renders a `TopbarStat`
    - Helper text listing the arguments and the allowed imports
- **Tests**:
    - `pages/Engine/__tests__/EngineEditorStore.test.ts`: load, save a description only, edit the code, save, stale, 422, delete
    - `EnginePage.test.tsx`: the menu shows both items, and the selection follows the route
- **Docs**: describe the Engine tab, the routes, `data/engine/` and TSX support in `docs/Visualizer.md`, `docs/Server.md` and `docs/SinglePlayerStandalone.md`.

## Part B — Convert `tmp/demo-story` to `stories/demo`

### B1. Scaffold + registration

- Copy `server/template/` into `stories/demo/`, with `types/`, `data/` and a `tsconfig.json` from `storyTsconfig()`. Delete the template's sample chapter, character, NPC and location.
- `.gitignore`: add `!stories/demo`.
- `server/seed/demo.story.json`: name "Demo", author, public, `mapSize`, a description, and a scrypt password hash made with the server's hash helper.
- Multi-seed:
    - `TImportStoryFilesOptions.seeds: TStorySeed[]`, and make `--seed` repeatable in `server/scripts/importStoryFiles.ts`.
    - `server/scripts/dev.ts` seeds example and demo.
    - `Dockerfile.prod` and `prod-entrypoint.sh` copy and pass both.
    - Keep today's rule (a seed folder is copied only into an empty database), since production doesn't exist yet. Update the importer tests.
- `scripts/typecheck-stories.mjs` already covers every folder under `stories/`.
- Add `stories/demo/data` as a vitest project, like `stories/example/data` in `vitest.workspace.ts:28`.

### B2. Mapping old → new

| Old (`tmp/demo-story/src`)                       | New (`stories/demo/data`)                                                    |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| `events/village/village.event.ts` (`TEvent`)     | `chapters/village/village.chapter.ts` (`TChapter`), same `timeRange`, `init` |
| `events/village/village.passages.ts`             | `chapters/village/village.passages.ts` (id → `(s, e) => passage`)            |
| `events/village/thomas.passages/**` (54 screens) | `chapters/village/thomas.passages/**`, same sub-folders                      |
| `events/village/triggers.ts` (`condition(s)`)    | `chapters/village/triggers.ts`: no args, closures, plus `name`               |
| `sideCharacters/*` (`TSideCharacter`)            | `npcs/*` (`TNpc`): `nobleMan`, `hunter`, `herbalist`                          |
| `characters/thomas.ts` (+ `quests`, `TQuest`)    | `characters/thomas.ts`; `stamina`, `hunger`, `quests` in `TThomasCharacterData` |
| `locations/village.location.ts` (`x`, `y`)       | `locations/village.location.ts` (`mapId`), plus `map.json`                   |
| `items/*Info.ts`                                 | `items/*Info.ts`, keeping the demo's own `TItemType` (defined per story)    |
| `eventId` / `s.events` / `register.events`       | `chapterId` / `s.chapters` / `register.chapters`                             |
| hard-coded start at `village-thomas-village`     | `startPassageId: 'village-thomas-intro'`                                     |
| `happenings/`, `races/`                          | dropped (never used)                                                         |
| `import { s, e } from 'worldState'`              | the passage arguments `(s, e)`                                               |

### B3. Passage conversion rules

- **Builders must be pure.** Move every random roll, `e.inventory.addItem`/`removeItem` and flag change out of the passage body.
    - Affected passages include `forestCutTrees`, `checkAnimalTraps`, `setupAnimalTraps`, `trackSmallAnimals`, `searchForHerbs`, the `forest*NobleMan` passages, the `…Search` screens, all `robbery/*`, the quest-finish passages, `breakIntoNobleHouse`, `nobleHouseLookAround`, `tellParentsHideaway` and `guardTellAboutRobbery`.
    - If the body doesn't show the result, the change goes into the passage's `execute`.
    - If the body shows a rolled value (e.g. wood or rabbit counts), it can't use `execute`, because the body is built first. Roll in the incoming link's `onFinish` instead. It runs as `turn.onStart`, before the passage is built. Store the result in chapter state (e.g. `s.chapters.village.lastFind`) and have the body read it.
    - Where several links lead to the same passage, a shared helper builds that `onFinish`.
- Keep the shared helpers `findNobleBody`, `createNobleHouseLinks`, `checkCharPresentNearNobleHouse` and `nobleHouse/utils.ts`. Split each into a pure part, which returns body blocks, and a mutating part, which is called from `execute` or `onFinish`.
- Keep `onFinish` mutations such as rest, sleep, eat, buying and starting quests.
- **Images:** no art exists. Keep `image` as alt text and add no `.png` files. Copy `public/story.png` to `data/assets/story.png` as the favicon.
- **Fix the known bugs while converting:**
    - `robberyFollowPerson` is missing its `s` argument.
    - The `nobleHouse…Search` screens set `= false` where `true` is meant.
    - `checkAnimalTraps` has the `5d` typo and wrong trap arithmetic.
    - `searchForHerbs` checks `stamina > 0.25` where `25` is meant.
    - `hunterHut` reuses the herbalist's night text.
    - A template literal is used inside `_()`.
    - `forestHurtNobleMan` checks potion `> 1` where `>= 1` is meant.
    - Duplicate link texts in the robbery passages.
- **Placeholders:** `robberyFollowHunter` (`'AAAA'`) and `empty` get a minimal "Not written yet" text and a link back to `village`, so every link resolves.

### B4. Engine settings for the demo

`stories/demo/data/engine/onLinkClick.ts`:

```ts
const STAMINA_PER_HOUR = 50 / 16; // the old engine's drain rate (`Story.spendTime`)
const HUNGER_PER_HOUR = STAMINA_PER_HOUR * 2.5;

/** Time spent on a link drains the character's stamina and hunger. */
export const onLinkClick: TOnLinkClick = ({ characterId, time }, s) => {
    const character = s.characters[characterId];
    character.stamina = Math.max(0, character.stamina - time.hour * STAMINA_PER_HOUR);
    character.hunger = Math.max(0, character.hunger - time.hour * HUNGER_PER_HOUR);
};
```

`stories/demo/data/engine/Topbar.tsx`:

```tsx
import { Bolt as BoltIcon, Favorite as FavoriteIcon, Restaurant as RestaurantIcon } from '@mui/icons-material';
import { TopbarStat } from '@story/ui';

/** Health, stamina and hunger of the main character. */
export const Topbar = ({ s }: TTopbarProps) => {
    const character = s.characters[s.mainCharacterId];
    return (
        <>
            <TopbarStat icon={FavoriteIcon} label={_('Health')} value={`${Math.floor(character.health)}%`} />
            <TopbarStat icon={BoltIcon} label={_('Stamina')} value={`${Math.floor(character.stamina)}%`} />
            <TopbarStat icon={RestaurantIcon} label={_('Hunger')} value={`${Math.floor(character.hunger)}%`} />
        </>
    );
};
```

- `hunger` means fullness: 100 is full. Thomas starts at health, stamina and hunger 100, with an axe, 30 gold and 2 lockpicks.

### B5. Demo tests (`stories/demo/data/__tests__/story.test.ts`)

- Adapt the example's integrity tests: every link resolves, every passage is reachable (with a `KNOWN_*` list if needed), builders are pure, and images follow the convention.
- Add an engine test: a 2h link lowers stamina by 6.25 and hunger by 15.625.

## Order of work

1. **A1 + A2:** types and the core `onLinkClick` hook, with tests.
2. **A3 + A4:** TSX and MUI icons in the loader and server, `TopbarStat` and `DefaultTopbar` in `@story/ui`, and the SinglePlayer topbar.
3. **B1–B4:** the demo story, playable at `?story=demo`.
4. **A5:** protocol and server engine routes.
5. **A6:** the Visualizer Engine tab, plus the `SideMenu` and `CodeEditor` extractions.
6. **B5 + docs.** Then run `yarn typecheck && yarn lint && yarn test`, and play the demo end to end in SinglePlayer and in the standalone export.

## Prepared for the AI agent (future, not in scope)

There is no AI integration yet. This plan keeps the way open for a server-side agent that turns a description into code:

- **The description is the agent's prompt.** It is stored next to the code, as JSDoc, so the code and its intent stay together in git.
- **The agent writes through `updateEngineSection`** with `code` only. The endpoint's 422 diagnostics (syntax, missing export, new type errors) give it a feedback loop to retry against.
- **`implemented: false` marks the settings to generate.** Later, an "Implement with AI" button can sit next to "Implement manually" in the editor.
- **The same pattern fits other function fields later**, such as passage `execute` and link `onFinish`, which already have a `description` in `TFunctionDto`.
