// tsc drops a .d.ts from `include` when a same-named .ts sits next to it
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./translations.d.ts" />

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any)._ = (inputStr: string, ...values: (string | number)[]) => {
    return applyFormatting(inputStr, values);
};

const applyFormatting = (str: string, values: (string | number)[]) =>
    values.reduce((acc: string, val) => acc.replace(typeof val === 'number' ? '%d' : '%s', String(val)), str);

export { applyFormatting };
