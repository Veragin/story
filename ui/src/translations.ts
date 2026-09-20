// Not redundant, and not replaceable by an `import`: TypeScript drops `x.d.ts` from an
// `include` glob when `x.ts` sits next to it (it assumes the .d.ts is that file's emit),
// so the ambient `_` declared in ./translations.d.ts only reaches the program through this
// explicit reference — which also ties the declaration to the module that installs it.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./translations.d.ts" />

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any)._ = (inputStr: string, ...values: (string | number)[]) => {
    return applyFormatting(inputStr, values);
};

const applyFormatting = (str: string, values: (string | number)[]) =>
    values.reduce((acc: string, val) => acc.replace(typeof val === 'number' ? '%d' : '%s', String(val)), str);

export { applyFormatting };
