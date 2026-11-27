import '@story/shared'; // installs the global `_`
import { describe, expect, it } from 'vitest';
import {
    functionToValue,
    isNumber,
    parseAs,
    parseLiteral,
    parseValueSource,
    toFunctionDto,
    toMaybeCode,
    valueToSource,
} from '../valueSource';
import { parseStringLiteral } from '../codeLiterals';

describe('valueToSource', () => {
    it('renders values as source', () => {
        expect(valueToSource({ asd: "it's", time: false })).toBe("{ asd: 'it\\'s', time: false }");
        expect(valueToSource([{ id: 'bow', amount: 1 }])).toBe("[{ id: 'bow', amount: 1 }]");
        expect(valueToSource({ code: 's.x > 1' })).toBe('s.x > 1');
        expect(valueToSource({ 'a-b': 1 })).toBe("{ 'a-b': 1 }");
        expect(valueToSource(undefined)).toBe('undefined');
        expect(valueToSource(null)).toBe('null');
        expect(valueToSource({})).toBe('{}');
        expect(valueToSource([])).toBe('[]');
    });

    it('breaks long values over lines', () => {
        const long = { description: 'x'.repeat(40), name: 'Annie', health: 10 };
        expect(valueToSource(long)).toBe(
            `{\n    description: '${'x'.repeat(40)}',\n    name: 'Annie',\n    health: 10,\n}`
        );
    });
});

describe('parseValueSource', () => {
    const parsed = (source: string) => {
        const result = parseValueSource(source);
        return result.ok ? result.value : { error: result.error };
    };

    it('parses literals, arrays and objects', () => {
        expect(parsed("'Forest'")).toBe('Forest');
        expect(parsed('-1.5')).toBe(-1.5);
        expect(parsed('true')).toBe(true);
        expect(parsed('null')).toBe(null);
        expect(parsed("[1, 'a', [true]]")).toEqual([1, 'a', [true]]);
        expect(parsed("{ health: 10, 'full name': \"A\", 3: 'x', inventory: [{ id: 'axe' }], }")).toEqual({
            'health': 10,
            'full name': 'A',
            '3': 'x',
            'inventory': [{ id: 'axe' }],
        });
        expect(parsed('{}')).toEqual({});
    });

    it('keeps nested expressions as code', () => {
        expect(parsed("{ name: _('Annie'), at: s.time.add(1), list: [a, 'b'] }")).toEqual({
            name: { code: "_('Annie')" },
            at: { code: 's.time.add(1)' },
            list: [{ code: 'a' }, 'b'],
        });
        expect(parsed("'a' + 'b'")).toEqual({ code: "'a' + 'b'" });
        expect(parsed('`hi ${name}`')).toEqual({ code: '`hi ${name}`' });
        expect(parsed('{ ...base, x: 1 }')).toEqual({ code: '{ ...base, x: 1 }' });
        expect(parsed('{ a: 1 }.a')).toEqual({ code: '{ a: 1 }.a' });
    });

    it('keeps a literal `{ code }` object as source so it round-trips', () => {
        expect(parsed("{ code: 'x' }")).toEqual({ code: "{ code: 'x' }" });
    });

    it('skips strings and comments when matching brackets', () => {
        expect(parsed('{ a: \'}\', // }\n b: "]" /* ] */ }')).toEqual({ a: '}', b: ']' });
    });

    it('reports broken syntax', () => {
        expect(parsed('{ a: 1')).toEqual({ error: 'Missing }' });
        expect(parsed('{ a: 1 }}')).toEqual({ error: 'Unexpected }' });
        expect(parsed('[1, 2)')).toEqual({ error: 'Unexpected )' });
        expect(parsed("{ a: 'x }")).toEqual({ error: 'Unterminated string' });
        expect(parsed('{ a: }')).toEqual({ error: 'a: Missing value' });
        expect(parsed('[1,, 2]')).toEqual({ error: 'Unexpected ,' });
        expect(parsed('')).toEqual({ error: 'Missing value' });
    });

    it('round-trips with valueToSource', () => {
        const value = { a: [1, { b: 'it\'s "x"\n' }], c: { code: 'f()' }, d: null };
        expect(parsed(valueToSource(value))).toEqual(value);
    });
});

describe('helpers', () => {
    it('parses plain literals only', () => {
        expect(parseLiteral("'it\\'s'")).toBe("it's");
        expect(parseLiteral("'a' + 'b'")).toBeUndefined();
        expect(parseLiteral('10')).toBe(10);
        expect(parseLiteral("_('kingdom')")).toBeUndefined();
        expect(parseLiteral('[1]')).toBeUndefined();
        expect(parseAs(isNumber)('7')).toBe(7);
        expect(parseAs(isNumber)("'7'")).toBeUndefined();
    });

    it('reads a single string token only', () => {
        expect(parseStringLiteral("'a' + 'b'")).toBeUndefined();
        expect(parseStringLiteral('"say \\"hi\\""')).toBe('say "hi"');
    });

    it('shows a value of the wrong shape as code', () => {
        expect(toMaybeCode('x', isNumber)).toEqual({ code: "'x'" });
        expect(toMaybeCode(3, isNumber)).toBe(3);
        expect(toMaybeCode({ code: 'n' }, isNumber)).toEqual({ code: 'n' });
    });

    it('maps functions to and from values', () => {
        expect(toFunctionDto({ code: '() => {}' })).toEqual({ code: '() => {}' });
        expect(toFunctionDto({ code: 'f', description: 'Heals.' })).toEqual({ code: 'f', description: 'Heals.' });
        expect(toFunctionDto(5)).toEqual({ code: '5' });
        expect(functionToValue({ code: 'f', description: '' })).toEqual({ code: 'f' });
        expect(functionToValue({ code: 'f', description: 'Heals.' })).toEqual({ code: 'f', description: 'Heals.' });
    });
});
