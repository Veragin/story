# AI input improvements: implementation plan

Source: `plans/fixes.md`. Scope: `clients/Visualizer/src/ai/` plus a small hook in the chapter graph and the agent's skill docs.

## Current state

- `ai/AiInput.tsx`: a controlled MUI `TextField`. Enter sends, Shift+Enter adds a newline. The field is disabled while `store.locked`, and the hints are hidden then.
- `ai/AiCommandHints.tsx`: a popup shown when the draft starts with `/`. You can only pick with the mouse (`onClick` → `setDraft('/cmd ')`). It has no keyboard navigation and `aria-selected` is always `false`.
- `ai/aiCommands.ts`: `AI_COMMANDS` and `matchingCommands(draft)` (used only by `AiCommandHints`).
- Entity names come from `entityStore.project` (`TProjectDto`: `characters`, `npcs`, `locations`, `items` (with `type`), `chapters`, each `{ id, name }`).
- `ENTITY_KINDS` (`characters`, `npcs`, `locations`, `items`) already exists in `protocol/src/dto/entity.ts`.
- Passages are listed per chapter only (`api.listChapterPassages(chapterId)`, which returns full passage DTOs plus edges). `api.getChapter(chapterId)` returns `characters[].passageIds` without titles. `passageId` is globally unique (`<chapterId>-<characterId>-<localId>`).
- On a chapter page, `ChapterGraphStore` (created in `pages/Chapter/ChapterPage.tsx`) already holds that chapter's `passages: TPassageDto[]` and keeps them current through `apiEvents`.
- Clicking a passage box in the graph calls `store.openEditor(id)` (`pages/Chapter/graph/ChapterGraphCanvas.tsx`, `onClick` interaction).
- `SelectionController` also handles Escape (it clears the graph selection).

## Design: one suggestion engine, two providers

Commands (`/`) and references (`@`) share the same dropdown, the same keyboard model and the same "replace the trailing token" logic. It works like the Claude CLI.

There is **no caret tracking**. Suggestions apply only to the **last word of the draft**, and accepting one always replaces that word. The caret position inside the textarea is ignored.

```
TSuggestion  = { key: string; label: string; detail?: string; value: string; continues: boolean }
TActiveToken = { start: number; trigger: '/' | '@'; query: string }
```

- `value` is the completed token text without the trailing separator (`/resume`, `@character:`, `@character:thomas`). Accepting it inserts `value`, plus a trailing space when `continues` is false.
- `continues: true` keeps the dropdown open after the suggestion is accepted. A class like `@character:` continues; a finished `@character:thomas` does not.

### Keyboard model

**Tab is the only key that fills in a suggestion without an arrow selection. Enter accepts a suggestion only after the user has picked one with the arrows.** This is a deliberate change from `plans/fixes.md`, which allowed Enter to fill in too.

While the dropdown is open:

| Key | Behaviour |
| --- | --- |
| Tab | With an arrow selection: accepts the selected item. Without one: if there is a single match, accepts it; if all matches share a longer prefix than what's typed, fills in that prefix (see Common-prefix completion); otherwise accepts the first item. Does nothing (and keeps focus) when the list is empty. |
| ArrowDown / ArrowUp | Starts selecting (Down → first item, Up → last item), then moves the selection, wrapping at the ends. Does nothing when the list is empty. |
| Enter | Accepts the selected item **only if the user has selected one with the arrows**. Otherwise it sends the message as it does today. |
| Escape | Closes the dropdown until the token changes. Calls `stopPropagation` so it does not also clear the graph selection. |
| Shift+Enter | Always adds a newline. |

- The selection starts empty (`activeIndex = null`) and returns to `null` whenever the token text changes. Until the user presses an arrow key, no row is highlighted and Enter always sends.
- All keys go to the IME while `e.nativeEvent.isComposing` is true, Escape included (it cancels the composition there).
- While the dropdown is closed, keys behave as they do today.
- Known trade-off: while the dropdown is open, ArrowUp/Down select items and do not move the caret between lines of a multi-line draft. Escape gets out of it.

Examples:

- `/res` + Tab → `/resume `.
- `/res` + Enter sends `/res`.
- `/res` + ArrowDown + Enter → `/resume ` (not sent).
- `@` + Tab → `@character:`.
- `@` + Enter sends `@`.
- `@passage:vil` + Tab, with matches `village-thomas-intro` and `village-thomas-forest` → `@passage:village-thomas-` (dropdown stays open).

### Common-prefix completion

Like shell completion: Tab without an arrow selection first tries to extend the token to the longest common prefix of all matches.

- `commonPrefix(values)` in `aiToken.ts` returns the longest common prefix of the matches' `value`s.
- It is computed over the **full match set**, before the display cap (20, or 10 for passages). Otherwise rows that are cut off would give a prefix that is too long.
- It applies only when that prefix starts with the typed token (case-insensitive) and is longer than it. Matches found by name and not by id usually break this, and then Tab falls back to the first item.
- The prefix is inserted as the values spell it (`@passage:Vil` → `@passage:village-`), with no trailing space, and the dropdown stays open.
- A single match is accepted as a whole item (with its trailing space or `:`), not as a prefix.
- The same rule applies to every provider, so `@ch` + Tab (character, chapter) → `@cha`, and a second Tab → `@character:` (first item). `/` + Tab still gives `/clear` because the commands share no longer prefix.

### Empty lists

Once the token names a known class (`@npc:`, `@npc:xy`), the dropdown stays open even when that class has no matching entries, because none exist yet or none match the query. In that case it shows an **empty list** with no rows and no placeholder message. An unknown class (`@foo:`) or an `@` prefix that matches no class (`@zz`) closes the dropdown.

### New / changed files

| File | Change |
| --- | --- |
| `ai/aiToken.ts` (new) | Pure helpers. `findActiveToken(draft)` returns the trailing token, or `null` when the draft ends with whitespace. A `/` token is valid only when it is the whole draft so far (start 0, no whitespace). An `@` token is the last word when it starts with `@` and begins the draft or follows whitespace. `replaceToken(draft, token, text) → string` returns `draft.slice(0, token.start) + text`. `commonPrefix(values) → string` (see Common-prefix completion). |
| `ai/aiMentions.ts` (new) | `MENTION_CLASSES` is derived from `ENTITY_KINDS` (singular class name → plural kind: `character→characters`, `npc→npcs`, `location→locations`, `item→items`) plus `chapter→chapters` and `passage→passages`, each with a localized label. Also `mentionSuggestions(query, sources)`, which returns `{ classKnown: boolean; matches: TSuggestion[] }` with the full, uncapped match set. With no `:`, it filters the classes by prefix. With `class:`, it filters that class's entries by id or name (case-insensitive substring match). The store caps what is displayed: 20 rows, or 10 for passages outside a chapter. Items use their `type` as `detail`. `formatMention(kind, id)` returns `@kind:id`. |
| `ai/aiCommands.ts` | Replace `matchingCommands` with `commandSuggestions(token)`, which returns `TSuggestion[]` with `value: '/name'` and `continues: false`. |
| `ai/AiSuggestStore.ts` (new, MobX) | Owned by `AiStore` (`aiStore.suggest`). Observables: `activeIndex: number \| null`, `dismissedToken: string \| null`. Computed: `token` (from `draft`), `matches` (full set from the command or mention provider), `items` (`matches` after the display cap), and `open`. `open` requires all of: the input is not `locked`; the token's raw text ≠ `dismissedToken`; and one of the following: `items` is non-empty, the token names a known class (see Empty lists), passages are loading, or `awaitingPassage` is true. Actions: `move(±1)`, `accept(index?)` (calls `replaceToken`, updates `draft`, bumps `focusRequest`), `complete()` (the Tab logic: selected item → single match → common prefix → first item), `dismiss`. A `reaction` keyed on the token's raw text resets `activeIndex` to `null`, and also resets `dismissedToken` when the token becomes `null`, so a dismissed `@` doesn't stay dismissed after sending. The reaction is keyed on the text, not on `items`, because `items` is a new array on every recompute, including unrelated `project` updates. |
| `ai/AiSuggestions.tsx` (replaces `AiCommandHints.tsx`) | Generic listbox whose `aria-label` follows the provider ("Commands" / "References"). Renders `items` with the selected row (`aria-selected`, `selected` prop, `scrollIntoView({ block: 'nearest' })`) and a stable `id` per row. `onMouseDown` calls `preventDefault` so the textarea keeps focus. A click calls `accept(i)`. Hover does not change the selection, so a resting mouse cannot change what Enter does. |
| `ai/AiInput.tsx` | Route `onKeyDown` through `suggest` first, following the keyboard model above. The textarea gets `role="combobox"`, `aria-expanded={open}`, `aria-controls` (the listbox id) and `aria-activedescendant` (the selected row id). It watches `aiStore.focusRequest` in a `useLayoutEffect`: focus the textarea and move the caret to the end. |
| `ai/AiStore.ts` | Gains optional constructor options `entities?: Pick<EntityStore, 'project' \| 'start'>` and `passages?: PassageIndex`. Optional, so the existing `new AiStore({ api })` tests keep working, and `context.ts` passes them. The sources are read **live** inside computeds, not copied at construction. `AiStore`'s `RefCountedSubscription` also acquires `entities.start()`, so `project` is loaded while the AI is active (`AiSidebar` stays untouched). Adds `focusRequest` (a counter) and `insertMention(kind, id)`. If the draft has a trailing `@` token (including a partial `@passage:xy`), `insertMention` replaces it. Otherwise it appends to the draft, with a leading space when needed. It always adds the trailing space, then bumps `focusRequest`. |

### Passage source

`ai/PassageIndex.ts` (new, MobX): `passages: { id, title, chapterId }[]` (computed), `loading`, and a `load()` that runs on demand. It has two modes:

- **In a chapter:** `ChapterPage` registers its `ChapterGraphStore` in an effect: `aiStore.passages.attachChapter(store)`, which returns a release function called on unmount. While a chapter is attached, `passages` reads that store's `passages` directly. Nothing is fetched, and the list is already current because the graph store follows `apiEvents`. Only this chapter's passages are suggested, and the 20-row display cap applies.
- **Outside a chapter:** the first `@passage:` token triggers `load()`. It fetches every chapter in `project.chapters` with `api.listChapterPassages` and caches the result. `apiEvents` passage/chapter events invalidate the cache (name the exact resource kind when implementing). The dropdown shows **at most 10 passages**.
- While it loads, the dropdown shows a "Loading passages…" row. Once loaded with no passages, it shows an empty list (see Empty lists).
- Passage titles are `TMaybeCode<string>`. Show plain strings, and show the id when the title is code.

## Feature 1: `@` class → entity suggestions

1. Type `@` and the dropdown lists `character, npc, location, item, chapter, passage`, filtered as you type (`@ch` → character, chapter).
2. Tab (or ArrowDown + Enter) on a class inserts `@character:` (`continues: true`). The dropdown stays open and lists that class's entries, or an empty list if none exist.
3. Tab (or ArrowDown + Enter) on an entry inserts `@character:thomas ` and closes the dropdown.
4. Typing `@character:th` directly works the same way, since it uses the same token parser.

## Feature 2: click a passage while an `@` is pending

- `AiSuggestStore.awaitingPassage` (computed) is true when all of these hold:
  - the AI sidebar is visible and the input is not `locked`;
  - the token has not been dismissed with Escape;
  - the trailing token is `@`;
  - its class is empty, a prefix of `passage`, or exactly `passage`, with or without a partial query (`@passage:xy`).
- Since there is no caret, blurring the textarea by clicking the canvas changes nothing.
- In the `onClick` interaction in `ChapterGraphCanvas.tsx`:
  ```ts
  if (data?.kind === 'passage') {
      if (aiStore.suggest.awaitingPassage) aiStore.insertMention('passage', data.node.id);
      else store.openEditor(data.node.id);
  }
  ```
- **The mode clears once a passage is picked.** `insertMention` ends the draft with `@passage:<id> `, so there is no trailing `@` token and `awaitingPassage` becomes false. The next click opens the editor again.
- `insertMention` bumps `focusRequest`, so the AI textarea gets focus back without passing DOM refs around.
- While `awaitingPassage` is true, the dropdown shows a hint row ("…or click a passage in the graph"). `awaitingPassage` keeps the dropdown open, so the hint stays visible even when the list is empty.
- `onPointerDown` still selects the clicked box before `onClick` runs. This is accepted.

## Feature 3: Tab completes slash commands

This falls out of the shared keyboard model: `/res` + Tab gives `/resume `. Enter never fills in a suggestion on its own. It does so only after the user picks one with the arrows. Whitespace in the draft ends the `/` token, so after completion Enter sends normally.

## Agent side

Add a "References in messages" section to `server/ai/agent/skills/story-files/SKILL.md`, with a one-line pointer from `server/ai/agent/CLAUDE.md`. It says that `@<class>:<id>` refers to the matching story entity and where to find it (checked against `stories/demo/data`):

| Reference | Where |
| --- | --- |
| `@character:<id>` | `data/characters/<id>.ts` |
| `@npc:<id>` | a file in `data/npcs/` whose `id` matches. The file name is not the id: `Herbalist.ts` has `id: 'herbalist'`. |
| `@location:<id>` | `data/locations/<id>.location.ts` |
| `@item:<id>` | an entry in one of the catalog files in `data/items/` (`foodInfo.ts`, `toolInfo.ts`, …). There is one file per catalog, not per item. |
| `@chapter:<id>` | `data/chapters/<id>/<id>.chapter.ts` |
| `@passage:<chapterId>-<characterId>-<localId>` | `data/chapters/<chapterId>/<characterId>.passages/<localId>.ts`. By convention ids don't contain `-` (it isn't enforced), so split on the first two `-`. |

No server code changes are needed because the text is passed through unchanged.

## Tests

- `ai/__tests__/aiToken.test.ts`: trailing-token detection (start of draft / after whitespace / mid-word `a@b` is ignored / a draft ending in whitespace gives no token / `/` only at the start), replacement, and `commonPrefix` (empty list, one value, no shared prefix).
- `ai/__tests__/aiMentions.test.ts`: class filtering, entity filtering by id and name, the uncapped match set, `classKnown` for a known class with no entries.
- `ai/__tests__/AiSuggestStore.test.ts`: Tab order (selected item → single match → common prefix → first item); the prefix is computed over all matches, not just displayed rows; a name-only match falls back to the first item; the display caps (20, and 10 for passages outside a chapter).
- `ai/__tests__/PassageIndex.test.ts`: with a chapter attached it uses that chapter's passages and calls no API; after release it lazy-loads all chapters; the cache is invalidated by an event.
- `ai/__tests__/AiInput.test.tsx`:
  - Update the existing hint test: the click still works and `aria-selected` follows the arrow keys.
  - `/res` + Tab gives `/resume `. `/res` + Enter sends `/res`. `/res` + ArrowDown + Enter gives `/resume ` and does not send. `/clear` + Enter sends.
  - `@` + Tab gives `@character:`. `@` + Enter sends `@`. `@ch` + Tab gives `@cha`.
  - `@passage:vil` + Tab with two `village-thomas-…` passages gives `@passage:village-thomas-` and the dropdown stays open. `@` + ArrowDown + ArrowDown + Enter gives `@npc:`, then Tab on an entry gives `@npc:<id> `.
  - `@npc:` with no npcs keeps the listbox open with no options, and Tab does nothing.
  - Typing after an arrow selection resets it, so Enter sends again.
  - Escape closes the dropdown, and Enter then sends.
- `ai/__tests__/AiStore.test.ts`:
  - `insertMention` replaces a trailing `@` token (including `@passage:xy`) or appends with a leading space.
  - `awaitingPassage` is false after the insert, after Escape, and while `locked`.
  - `dismissedToken` is cleared after sending, so the next `@` opens the dropdown.
- Graph: a test where clicking a passage with a pending `@` inserts the reference and does not open the editor, and a second click opens the editor. Try driving the interactions the way `canvas/controllers/controllers.test.ts` does. If that is too heavy, cover it at the `AiStore.insertMention` / `awaitingPassage` level instead.

## Order of work

1. `aiToken.ts` (including `commonPrefix`) + tests.
2. `AiSuggestStore` + `AiSuggestions` + the keyboard model with common-prefix Tab, migrating commands first (Feature 3). The existing tests stay green.
3. `aiMentions.ts` + entity source (Feature 1).
4. `PassageIndex` (chapter attach + lazy load) + passage suggestions.
5. Graph click integration and focus request (Feature 2).
6. Agent skill section.

## Decisions

- Classes are limited to character, npc, location, item, chapter and passage. Triggers and other catalogs are left out.
- Passages: in a chapter, the open chapter's passages from `ChapterGraphStore`; elsewhere, all chapters loaded lazily, with at most 10 shown.
