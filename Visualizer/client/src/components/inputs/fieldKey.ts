const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export const fieldKeyError = (key: string, existing: Iterable<string>): string | null => {
    if (key === '') return null;
    if (!IDENTIFIER_RE.test(key)) return _('Not an identifier');
    return new Set(existing).has(key) ? _('Already there') : null;
};

export const freeFieldKey = (base: string, existing: Iterable<string>): string => {
    const taken = new Set(existing);
    if (!taken.has(base)) return base;
    let n = 2;
    while (taken.has(`${base}${n}`)) n++;
    return `${base}${n}`;
};
