export const BULLET = '•';
export const BULLET_INDENT = '    ';

export type TTextSelection = {
    value: string;
    selectionStart: number;
    selectionEnd: number;
};

export type TBulletKey = {
    key: string;
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
};

type TLineShift = { at: number; delta: number };

const BULLET_PREFIX = new RegExp(`^( *)${BULLET} `);
const BULLET_TRIGGER = /^( *)\*$/;

const lineStartOf = (value: string, at: number) => value.lastIndexOf('\n', at - 1) + 1;

const lineEndOf = (value: string, at: number) => {
    const end = value.indexOf('\n', at);
    return end === -1 ? value.length : end;
};

const bulletPrefixOf = (line: string) => BULLET_PREFIX.exec(line);

const replaceRange = (value: string, from: number, to: number, insert: string): TTextSelection => {
    const caret = from + insert.length;
    return {
        value: value.slice(0, from) + insert + value.slice(to),
        selectionStart: caret,
        selectionEnd: caret,
    };
};

const startBullet = ({ value, selectionStart, selectionEnd }: TTextSelection) => {
    if (selectionStart !== selectionEnd) return null;
    const lineStart = lineStartOf(value, selectionStart);
    const trigger = BULLET_TRIGGER.exec(value.slice(lineStart, selectionStart));
    if (!trigger) return null;
    return replaceRange(value, selectionStart - 1, selectionStart, `${BULLET} `);
};

const continueBullet = ({ value, selectionStart, selectionEnd }: TTextSelection) => {
    const lineStart = lineStartOf(value, selectionStart);
    const lineEnd = lineEndOf(value, selectionStart);
    const prefix = bulletPrefixOf(value.slice(lineStart, lineEnd));
    if (!prefix || selectionStart < lineStart + prefix[0].length) return null;
    const emptyItem = selectionStart === selectionEnd && lineEnd - lineStart === prefix[0].length;
    if (emptyItem) return replaceRange(value, lineStart, lineEnd, '');
    return replaceRange(value, selectionStart, selectionEnd, `\n${prefix[1]}${BULLET} `);
};

const removeBullet = ({ value, selectionStart, selectionEnd }: TTextSelection) => {
    if (selectionStart !== selectionEnd) return null;
    const lineStart = lineStartOf(value, selectionStart);
    const prefix = bulletPrefixOf(value.slice(lineStart, selectionStart));
    if (!prefix || selectionStart !== lineStart + prefix[0].length) return null;
    return replaceRange(value, lineStart, selectionStart, '');
};

const shiftPosition = (at: number, shifts: readonly TLineShift[]) =>
    shifts.reduce(
        (moved, { at: lineAt, delta }) =>
            lineAt > at ? moved : moved + (delta >= 0 ? delta : Math.max(delta, lineAt - at)),
        at
    );

const indentBullets = ({ value, selectionStart, selectionEnd }: TTextSelection, outdent: boolean) => {
    const from = lineStartOf(value, selectionStart);
    if (!bulletPrefixOf(value.slice(from, lineEndOf(value, from)))) return null;
    const lines = value.slice(from, lineEndOf(value, selectionEnd)).split('\n');
    const shifts: TLineShift[] = [];
    const shifted = lines.reduce<{ at: number; lines: string[] }>(
        (acc, line) => {
            const prefix = bulletPrefixOf(line);
            const removable = Math.min(prefix?.[1].length ?? 0, BULLET_INDENT.length);
            const delta = !prefix ? 0 : outdent ? -removable : BULLET_INDENT.length;
            if (delta !== 0) shifts.push({ at: acc.at, delta });
            const next = delta > 0 ? BULLET_INDENT + line : line.slice(-delta);
            return {
                at: acc.at + line.length + 1,
                lines: [...acc.lines, next],
            };
        },
        { at: from, lines: [] }
    );
    const text = shifted.lines.join('\n');
    return {
        value: value.slice(0, from) + text + value.slice(from + lines.join('\n').length),
        selectionStart: shiftPosition(selectionStart, shifts),
        selectionEnd: shiftPosition(selectionEnd, shifts),
    };
};

export const bulletListEdit = (
    text: TTextSelection,
    { key, shiftKey, ctrlKey, metaKey, altKey }: TBulletKey
): TTextSelection | null => {
    if (ctrlKey || metaKey || altKey) return null;
    if (key === 'Tab') return indentBullets(text, shiftKey);
    if (shiftKey) return null;
    if (key === ' ') return startBullet(text);
    if (key === 'Enter') return continueBullet(text);
    if (key === 'Backspace') return removeBullet(text);
    return null;
};
