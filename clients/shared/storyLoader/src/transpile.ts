import { init, parse } from 'es-module-lexer';
import { transform } from 'sucrase';
import { errorText, StoryLoaderError } from './StoryLoaderError';

export const STORY_IMPORT = '__storyImport';

const IMPORT_KEYWORD = 'import';

const STATIC_IMPORT = -1;
const IMPORT_META = -2;

export type TTranspiled = {
    // CommonJS, run with `require`, `module`, `exports` and `__storyImport` in scope
    code: string;
    staticImports: string[];
};

const LIMITS =
    'Story files are compiled one by one: values in a `namespace`, `declare enum` and `declare const` are not emitted.';

const compileError = (path: string, step: string, err: unknown) =>
    new StoryLoaderError(path, `${step} failed: ${errorText(err)}. ${LIMITS}`, err);

const stripTypes = (path: string, source: string): string => {
    try {
        return transform(source, { transforms: ['typescript'], disableESTransforms: true, filePath: path }).code;
    } catch (err: unknown) {
        throw compileError(path, 'TypeScript', err);
    }
};

const toCommonJs = (path: string, esm: string): string => {
    try {
        return transform(esm, {
            transforms: ['imports'],
            disableESTransforms: true,
            preserveDynamicImport: true,
            filePath: path,
        }).code;
    } catch (err: unknown) {
        throw compileError(path, 'Module transform', err);
    }
};

const lex = (path: string, esm: string) => {
    try {
        return parse(esm, path)[0];
    } catch (err: unknown) {
        throw compileError(path, 'Import scan', err);
    }
};

export const transpile = async (path: string, source: string): Promise<TTranspiled> => {
    await init;
    const esm = stripTypes(path, source);
    const imports = lex(path, esm);

    if (imports.some((i) => i.d === IMPORT_META)) {
        throw new StoryLoaderError(path, '`import.meta` is not available to story code');
    }

    const staticImports = imports.flatMap((i) => (i.d === STATIC_IMPORT && i.n !== undefined ? [i.n] : []));

    // by lexer position, from the end so earlier positions stay valid
    const rewritten = imports
        .filter((i) => i.d > STATIC_IMPORT)
        .reverse()
        .reduce((code, i) => code.slice(0, i.ss) + STORY_IMPORT + code.slice(i.ss + IMPORT_KEYWORD.length), esm);

    return { code: toCommonJs(path, rewritten), staticImports };
};
