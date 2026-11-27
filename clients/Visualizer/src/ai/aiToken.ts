export type TTokenTrigger = '/' | '@';

export type TActiveToken = {
    start: number;
    trigger: TTokenTrigger;
    query: string;
};

export type TSuggestion = {
    key: string;
    label: string;
    detail?: string;
    value: string;
    continues: boolean;
};

export const findActiveToken = (draft: string): TActiveToken | null => {
    if (draft === '' || /\s$/.test(draft)) return null;
    if (draft.startsWith('/') && !/\s/.test(draft)) return { start: 0, trigger: '/', query: draft.slice(1) };
    const start = draft.search(/\S+$/);
    if (draft[start] !== '@') return null;
    return { start, trigger: '@', query: draft.slice(start + 1) };
};

export const tokenText = (draft: string, token: TActiveToken): string => draft.slice(token.start);

export const replaceToken = (draft: string, token: TActiveToken, text: string): string =>
    draft.slice(0, token.start) + text;

export const commonPrefix = (values: readonly string[]): string => {
    if (values.length === 0) return '';
    return values.reduce((prefix, value) => {
        let length = 0;
        while (length < prefix.length && prefix[length] === value[length]) length++;
        return prefix.slice(0, length);
    });
};
