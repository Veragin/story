// story code reads the global `_`: the translations must be installed before the first module runs
import '@story/shared';
import { createResolver, type TResolved, type TResolver } from './resolve';
import { errorText, StoryLoaderError } from './StoryLoaderError';
import { STORY_IMPORT, transpile, type TTranspiled } from './transpile';
import type { THostModules, TModuleExports, TStoryLoaderOptions, TStorySource } from './types';

type TCompiled = TTranspiled & { dependencies: Map<string, TResolved> };

type TModule = { exports: TModuleExports };

// what `import()` calls from the app are relative to and blamed on in errors
const APP_IMPORTER = '<app>';

/**
 * Runs a story's TypeScript source in the browser: fetches files from a `TStorySource`, transpiles them
 * and evaluates them as CommonJS (which tolerates import cycles). Static imports are fetched before a
 * module runs, dynamic `import()` (the per-chapter passages) only when called.
 */
export class StoryLoader {
    private readonly source: TStorySource;
    private readonly hostModules: THostModules;
    private readonly resolve: TResolver;
    private readonly compiling = new Map<string, Promise<TCompiled>>();
    private readonly compiled = new Map<string, TCompiled>();
    private readonly modules = new Map<string, TModule>();

    constructor({ source, files, hostModules }: TStoryLoaderOptions) {
        this.source = source;
        this.hostModules = hostModules;
        this.resolve = createResolver(files, hostModules);
    }

    /** `@story/data` for the story's entry; a relative specifier is relative to the story folder. */
    import = (specifier: string): Promise<TModuleExports> => this.importFrom(specifier, APP_IMPORTER);

    private importFrom = async (specifier: string, importer: string): Promise<TModuleExports> => {
        const resolved = this.resolve(specifier, importer);
        if (resolved.kind === 'host') return this.hostModules[resolved.specifier];
        await this.prefetch(resolved.path);
        return this.evaluate(resolved.path);
    };

    private compile = (path: string): Promise<TCompiled> => {
        const pending = this.compiling.get(path);
        if (pending) return pending;
        const compiling = this.fetchAndCompile(path);
        this.compiling.set(path, compiling);
        void this.forgetOnFailure(path, compiling);
        return compiling;
    };

    // a failed fetch may succeed on the next try
    private forgetOnFailure = async (path: string, compiling: Promise<TCompiled>) => {
        try {
            await compiling;
        } catch {
            this.compiling.delete(path);
        }
    };

    private fetchAndCompile = async (path: string): Promise<TCompiled> => {
        let source: string;
        try {
            source = await this.source.fetchText(path);
        } catch (err: unknown) {
            throw new StoryLoaderError(path, `could not be fetched: ${errorText(err)}`, err);
        }
        const transpiled = await transpile(path, source);
        const dependencies = new Map(transpiled.staticImports.map((s) => [s, this.resolve(s, path)]));
        const compiled = { ...transpiled, dependencies };
        this.compiled.set(path, compiled);
        return compiled;
    };

    // the whole static graph, in parallel; `seen` stops cycles
    private prefetch = async (entry: string) => {
        const seen = new Set<string>();
        const visit = async (path: string): Promise<void> => {
            if (seen.has(path) || this.modules.has(path)) return;
            seen.add(path);
            const { dependencies } = await this.compile(path);
            await Promise.all([...dependencies.values()].flatMap((d) => (d.kind === 'file' ? [visit(d.path)] : [])));
        };
        await visit(entry);
    };

    private evaluate = (path: string): TModuleExports => {
        const cached = this.modules.get(path);
        // in a cycle this is the importer's partly filled `exports`, as in CommonJS
        if (cached) return cached.exports;

        const compiled = this.compiled.get(path);
        if (!compiled) throw new StoryLoaderError(path, 'was not prefetched (loader bug)');

        const module: TModule = { exports: {} };
        this.modules.set(path, module);
        const require = (specifier: string) => this.require(specifier, path, compiled);
        const storyImport = (specifier: string) => this.importFrom(specifier, path);
        try {
            const run = new Function(
                'require',
                'module',
                'exports',
                STORY_IMPORT,
                `${compiled.code}\n//# sourceURL=story://${path}`
            );
            run(require, module, module.exports, storyImport);
        } catch (err: unknown) {
            this.modules.delete(path);
            if (err instanceof StoryLoaderError) throw err;
            throw new StoryLoaderError(path, `failed to run: ${errorText(err)}`, err);
        }
        return module.exports;
    };

    private require = (specifier: string, importer: string, compiled: TCompiled): TModuleExports => {
        const resolved = compiled.dependencies.get(specifier) ?? this.resolve(specifier, importer);
        return resolved.kind === 'host' ? this.hostModules[resolved.specifier] : this.evaluate(resolved.path);
    };
}
