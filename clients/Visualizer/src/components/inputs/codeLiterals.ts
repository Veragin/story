export const quoteString = (s: string) =>
    `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`;

export const parseStringLiteral = (code: string): string | undefined => {
    const m = /^(['"`])((?:\\[\s\S]|(?!\1)[^\\])*)\1$/.exec(code.trim());
    if (!m || (m[1] === '`' && m[2].includes('${'))) return undefined;
    const body = m[1] === '"' ? m[2] : m[2].replace(/\\'/g, "'").replace(/\\`/g, '`').replace(/"/g, '\\"');
    try {
        const parsed: unknown = JSON.parse(`"${body}"`);
        return typeof parsed === 'string' ? parsed : undefined;
    } catch {
        return undefined;
    }
};

export const codeToText = (code: string): string => {
    const call = /^_\(\s*([\s\S]*?)\s*\)$/.exec(code.trim());
    return parseStringLiteral(call ? call[1] : code) ?? code;
};
