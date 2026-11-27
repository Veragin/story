import { isOneOf } from './typeguards';

export const MENTION_CLASSES = ['character', 'npc', 'location', 'item', 'chapter', 'passage'] as const;

export type TMentionClass = (typeof MENTION_CLASSES)[number];

export const isMentionClass = (value: unknown): value is TMentionClass => isOneOf(value, MENTION_CLASSES);

export type TMention = {
    mentionClass: TMentionClass;
    id: string;
    /** Index of the `@`. */
    start: number;
    /** Index just past the id. */
    end: number;
};

/** The display name of a mentioned entity; `undefined` when it is unknown. */
export type TMentionNameOf = (mentionClass: TMentionClass, id: string) => string | undefined;

const ID = '[a-z][A-Za-z0-9_]*';
const PASSAGE_LOCAL_ID = '[A-Za-z0-9_]+(?:-[A-Za-z0-9_]+)*';

/**
 * `@<class>:<id>`. A passage id is `<chapter>-<character>-<local>`, so it keeps its hyphens; trailing punctuation is
 * not part of an id. Group 1 is the class, group 2 the id. Global: use it with `matchAll` / `replace`, not `test`.
 */
export const MENTION_PATTERN = new RegExp(
    `@(?:(character|npc|location|item|chapter):(${ID})|(passage):(${ID}-${ID}-${PASSAGE_LOCAL_ID}))`,
    'g'
);

/** `@<class>:` for a class of `MENTION_CLASSES`, whatever follows. */
const MENTION_START = new RegExp(`^@(?:${MENTION_CLASSES.join('|')}):`);

/** Whether `text` starts with `@<class>:`: a description with a mention, never an image link. */
export const startsWithMention = (text: string): boolean => MENTION_START.test(text);

export const formatMention = (mentionClass: TMentionClass, id: string): string => `@${mentionClass}:${id}`;

export const parseMentions = (text: string): TMention[] =>
    [...text.matchAll(MENTION_PATTERN)].flatMap((match) => {
        const mentionClass = match[1] ?? match[3];
        const id = match[2] ?? match[4];
        if (!isMentionClass(mentionClass) || id === undefined) return [];
        return [{ mentionClass, id, start: match.index, end: match.index + match[0].length }];
    });

/** Replaces every mention with its entity's name, or its id when the name is unknown. */
export const describeMentions = (text: string, nameOf: TMentionNameOf): string => {
    let described = '';
    let from = 0;
    for (const { mentionClass, id, start, end } of parseMentions(text)) {
        described += text.slice(from, start) + (nameOf(mentionClass, id) ?? id);
        from = end;
    }
    return described + text.slice(from);
};
