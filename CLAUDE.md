# Standards

## Code Style

- `async/await` only — no `.then()` chains
- Arrow functions over `function` (use `function` only when required, e.g. `asserts` type guards)
- SOLID + DRY: single responsibility; extract a shared utility once logic repeats 3+ times
- Avoid `as` casts and `!` non-null assertions — narrow types properly instead

## Naming

| Symbol                                  | Convention         | Example           |
| --------------------------------------- | ------------------ | ----------------- |
| Type                                    | `T` prefix         | `TPlayer`         |
| Interface                               | `I` prefix         | `IPlayer`         |
| Constant                                | `UPPER_SNAKE_CASE` | `DEFAULT_TIMEOUT` |
| Variable / function / method / property | `camelCase`        | `getUserById`     |
| Class / component                       | `PascalCase`       | `RecordingKeeper` |

## Files & Folders

- `lowercase/` folder or `lowercase.ts` → multiple related exports (`hooks/`, `logger.ts`)
- `Uppercase/` folder or `Uppercase.ts` → one feature / primary export matching the name (`SportSolution/SportSolution.tsx`, `RecordingKeeper.ts`)

## Exports

- Named exports only — never `export default`; one primary class/component per file
- Barrel `index.ts` only for utility packages

## Reuse

- Extract shared constants/components to their own files; search the codebase first to avoid duplication

## Comments

- Default to none — make the code self-explanatory with names and structure
- Add (or keep, when touching one) a comment only if removing it would make correct code look broken; then state _why_ in one tight phrase
- No JSDoc — types are the documentation; exception: the public API of shared internal packages

## React Components

- No `React.FC` — plain arrow functions: `export const MyComponent = ({ ... }: Props) => { ... };`
- One component per file (single responsibility)
- Pass time as `Time` / `DeltaTime`; use `TimeManager` to render
