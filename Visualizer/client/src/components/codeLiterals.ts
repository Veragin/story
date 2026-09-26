/** Literal ⇄ TS source helpers for `CodeField` (kept out of the .tsx for fast refresh). */

/** `'it\'s'` — a single-quoted TS string literal (prettier's style in this repo). */
export const quoteString = (s: string) =>
    `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`;

/** Reads a plain string literal back (`'a'`, `"a"`, a backtick string without `${`). */
export const parseStringLiteral = (code: string): string | undefined => {
    const m = /^(['"`])([\s\S]*)\1$/.exec(code.trim());
    if (!m || (m[1] === '`' && m[2].includes('${'))) return undefined;
    try {
        if (m[1] === '"') return JSON.parse(`"${m[2]}"`) as string;
        return JSON.parse(`"${m[2].replace(/\\'/g, "'").replace(/\\`/g, '`').replace(/"/g, '\\"')}"`) as string;
    } catch {
        return undefined;
    }
};
