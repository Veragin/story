import { isCode, isDeltaTime, type TLinkDto, type TMaybeCode } from '@story/visualizer-protocol';
import type { TOption } from '../../../../components/CodeField';
import { formatDelta } from '../costCode';
import type { TDiag } from './types';

/** A piece of the collapsed link line: plain text, or a code-valued part shown as `ƒ`. */
export type TSummaryPart = { text: string } | { code: string };

export type TLinkSummary = {
    /** The link text (`[]` when it is empty). */
    text: TSummaryPart[];
    /** `passageId (1 min) (2 Bread) [knife]`, the SingleEngine `PassageLink` format (plan D10). */
    details: TSummaryPart[];
};

const part = <T>(value: TMaybeCode<T>, literal: (v: T) => string): TSummaryPart =>
    isCode(value) ? { code: value.code } : { text: literal(value) };

/**
 * The collapsed line of a link, like SingleEngine renders it (`PassageLink.tsx` after
 * `processor.parseCost`): the text, then the target, the time when it is not zero, the items and
 * the tools. Item and tool names come from `items` (the item picker's options, labelled with
 * the item name), falling back to the id.
 */
export const linkSummary = (link: TLinkDto, items: TOption[]): TLinkSummary => {
    const name = (id: string) => items.find((i) => i.id === id)?.label || id;
    const text = isCode(link.text) ? [{ code: link.text.code }] : link.text === '' ? [] : [{ text: link.text }];
    const details: TSummaryPart[] = [part(link.passageId, (id) => id)];
    const cost = link.cost;
    if (cost === undefined) return { text, details };
    if (isCode(cost)) {
        details.push({ text: ' (' }, { code: cost.code }, { text: ')' });
        return { text, details };
    }
    const time = isDeltaTime(cost) ? cost : cost.time;
    if (time !== undefined && (isCode(time) || time.seconds > 0)) {
        details.push(
            { text: ' (' },
            part(time, (t) => formatDelta(t.seconds)),
            { text: ')' }
        );
    }
    if (isDeltaTime(cost)) return { text, details };
    if (cost.items !== undefined && (isCode(cost.items) || cost.items.length > 0)) {
        details.push(
            { text: ' (' },
            part(cost.items, (list) => list.map((i) => `${i.amount} ${name(i.id)}`).join(', ')),
            { text: ')' }
        );
    }
    if (cost.tools !== undefined && (isCode(cost.tools) || cost.tools.length > 0)) {
        details.push(
            { text: ' [' },
            part(cost.tools, (list) => list.map(name).join(', ')),
            { text: ']' }
        );
    }
    return { text, details };
};

/** Field paths under a link (relative to it) that can carry diagnostics (`diagnostics.ts`). */
const LINK_FIELDS = [
    '',
    '.text',
    '.passageId',
    '.autoPriortiy',
    '.cost',
    '.cost.time',
    '.cost.items',
    '.cost.tools',
    '.onFinish',
];

/** Whether the link at `path` (`body.0.links.1`) or any of its fields has diagnostics. */
export const linkHasDiagnostics = (diag: TDiag, path: string) =>
    LINK_FIELDS.some((f) => diag(`${path}${f}`).length > 0);
