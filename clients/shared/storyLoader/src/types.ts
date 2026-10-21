/** Where the story's files come from. `path` is story-relative: `data/index.ts`, `types/ids.ts`. */
export type TStorySource = {
    fetchText: (path: string) => Promise<string>;
};

/** The exports of an evaluated story module (`default` included). */
export type TModuleExports = Record<string, unknown>;

/** Specifier → module object the app already runs: `@story/shared`, `@story/core`. */
export type THostModules = Readonly<Record<string, TModuleExports>>;

export type TStoryLoaderOptions = {
    source: TStorySource;
    /** Every story-relative file the story has (the play manifest's `files`): resolution never probes the network. */
    files: readonly string[];
    hostModules: THostModules;
};
