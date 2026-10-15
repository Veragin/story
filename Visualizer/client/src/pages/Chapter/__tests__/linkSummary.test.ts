import { describe, expect, it } from 'vitest';
import type { TDiagnosticDto, TLinkDto } from '@story/visualizer-protocol';
import { formatDelta } from '../editor/costCode';
import { linkHasDiagnostics, linkSummary, type TSummaryPart } from '../editor/PassageEditor/linkSummary';

const plain = (parts: TSummaryPart[]) => parts.map((p) => ('code' in p ? 'ƒ' : p.text)).join('');

const items = [
    { id: 'bread', label: 'Bread' },
    { id: 'knife', label: 'Knife' },
];

const summary = (link: Partial<TLinkDto>) => {
    const s = linkSummary({ text: 'Go', passageId: 'village-thomas-forest', ...link }, items);
    return { text: plain(s.text), details: plain(s.details) };
};

describe('formatDelta', () => {
    it('formats minutes, hours, days and seconds', () => {
        expect(formatDelta(60)).toBe('1 min');
        expect(formatDelta(2 * 3600 + 5 * 60)).toBe('2 h 5 min');
        expect(formatDelta(86400 + 3 * 3600)).toBe('1 d 3 h');
        expect(formatDelta(90)).toBe('1 min 30 s');
        expect(formatDelta(0)).toBe('0 min');
    });
});

describe('linkSummary', () => {
    it('shows the text and the target without a cost', () => {
        expect(summary({})).toEqual({ text: 'Go', details: 'village-thomas-forest' });
    });

    it('shows a plain duration, and leaves a zero one out', () => {
        expect(summary({ cost: { seconds: 60 } }).details).toBe('village-thomas-forest (1 min)');
        expect(summary({ cost: { seconds: 0 } }).details).toBe('village-thomas-forest');
    });

    it('shows time, items and tools in the SingleEngine format, with item names', () => {
        const cost = {
            time: { seconds: 600 },
            items: [
                { id: 'bread', amount: 2 },
                { id: 'apple', amount: 1 },
            ],
            tools: ['knife'],
        };
        expect(summary({ cost }).details).toBe('village-thomas-forest (10 min) (2 Bread, 1 apple) [Knife]');
    });

    it('shows code-valued parts as ƒ with their code', () => {
        const s = linkSummary(
            {
                text: { code: "_('Go')" },
                passageId: { code: 'next' },
                cost: { time: { code: 'DeltaTime.fromMin(n)' }, tools: { code: 'tools' } },
            },
            items
        );
        expect(plain(s.text)).toBe('ƒ');
        expect(plain(s.details)).toBe('ƒ (ƒ) [ƒ]');
        expect(s.details[0]).toEqual({ code: 'next' });
        expect(summary({ cost: { code: 'cost' } }).details).toBe('village-thomas-forest (ƒ)');
    });

    it('has no text part for an empty text', () => {
        expect(summary({ text: '' }).text).toBe('');
    });
});

describe('linkHasDiagnostics', () => {
    const d: TDiagnosticDto = { file: 'f.ts', line: 1, column: 1, message: 'bad' };
    it('looks at the link and every field under it', () => {
        const byField = new Map([['body.0.links.1.cost.items', [d]]]);
        const diag = (path: string) => byField.get(path) ?? [];
        expect(linkHasDiagnostics(diag, 'body.0.links.1')).toBe(true);
        expect(linkHasDiagnostics(diag, 'body.0.links.0')).toBe(false);
    });
});
