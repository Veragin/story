import { Node, Project, SyntaxKind } from 'ts-morph';
import { describe, expect, it } from 'vitest';
import { formatJsDoc, getProp, parseJsDoc, readJsDoc } from '../src/project/ast';
import { applyPartial, readFields, S, type TField } from '../src/project/values';

/** JSDoc descriptions of `S.fn` fields (plan D1, D8), on an in-memory file. */
const FIELDS: Record<string, TField> = {
    execute: { schema: S.fn(), after: ['id'] },
    items: { schema: S.array(S.object({ condition: S.fn('true'), text: S.string })) },
};

const setup = (text: string) => {
    const sf = new Project({ useInMemoryFileSystem: true }).createSourceFile('a.ts', text);
    const obj = () =>
        sf.getVariableDeclarationOrThrow('x').getInitializerIfKindOrThrow(SyntaxKind.ObjectLiteralExpression);
    return {
        sf,
        read: () => readFields(obj(), FIELDS),
        apply: (body: Record<string, unknown>) => applyPartial(obj(), body, FIELDS, sf, { optional: ['execute'] }),
    };
};

describe('JSDoc helpers', () => {
    it('parses one-line, multi-line and escaped comments', () => {
        expect(parseJsDoc('/** Heals Annie. */')).toBe('Heals Annie.');
        expect(parseJsDoc('/**\n     * Heals Annie\n     *\n     * when weak.\n     */')).toBe(
            'Heals Annie\n\nwhen weak.'
        );
        expect(parseJsDoc('/** a *\\/ b */')).toBe('a */ b');
        expect(parseJsDoc('/**\n   no star\n */')).toBe('no star');
        expect(formatJsDoc('a */ b')).toBe('/** a *\\/ b */');
        expect(formatJsDoc('a\n\nb', '  ')).toBe('/**\n   * a\n   *\n   * b\n   */');
        for (const d of ['x', 'a */ b', 'line 1\nline 2', 'a\n\nb']) expect(parseJsDoc(formatJsDoc(d))).toBe(d);
    });

    it('reads only a /** */ comment directly before the property', () => {
        const sf = new Project({ useInMemoryFileSystem: true }).createSourceFile(
            'a.ts',
            `const x = {\n    /** doc */\n    a: 1,\n    /* plain */\n    b: 2,\n    /** far */\n    // between\n    c: 3, d: 4, /** inline */ e: 5,\n};\n`
        );
        const obj = sf.getFirstDescendantByKindOrThrow(SyntaxKind.ObjectLiteralExpression);
        const doc = (k: string) => readJsDoc(getProp(obj, k)!);
        expect([doc('a'), doc('b'), doc('c'), doc('d'), doc('e')]).toEqual([
            'doc',
            undefined,
            undefined,
            undefined,
            'inline',
        ]);
        expect(Node.isPropertyAssignment(getProp(obj, 'a'))).toBe(true);
    });
});

describe('S.fn', () => {
    it('reads code and description; an unchanged write keeps the text', () => {
        const text = `const x = {\n    id: 'a',\n    /** Heals. */\n    execute: () => {\n        heal();\n    },\n    items: [{ /** inline */ condition: s.ok, text: 't' }],\n};\n`;
        const t = setup(text);
        const dto = t.read();
        expect(dto).toEqual({
            execute: { code: '() => {\n        heal();\n    }', description: 'Heals.' },
            items: [{ condition: { code: 's.ok', description: 'inline' }, text: 't' }],
        });
        t.apply(dto);
        expect(t.sf.getFullText()).toBe(text);
    });

    it('edits an inline comment and several descriptions in one write', () => {
        const t = setup(
            `const x = {\n    id: 'a',\n    items: [{ /** one */ condition: a, text: 't' }, { condition: b, text: 'u' }],\n};\n`
        );
        t.apply({
            items: [
                { condition: { code: 'a', description: 'uno' }, text: 't' },
                { condition: { code: 'b2', description: 'dos' }, text: 'u' },
            ],
        });
        expect(t.sf.getFullText()).toBe(
            `const x = {\n    id: 'a',\n    items: [{ /** uno */ condition: a, text: 't' }, { /** dos */ condition: b2, text: 'u' }],\n};\n`
        );
        t.apply({ items: [{ condition: { code: 'a' }, text: 't' }, { text: 'u' }] });
        expect(t.sf.getFullText()).toBe(
            `const x = {\n    id: 'a',\n    items: [{ condition: a, text: 't' }, { text: 'u' }],\n};\n`
        );
    });

    it('adds a description-only stub with its default code, and removes it with its comment', () => {
        const t = setup(`const x = {\n    id: 'a',\n    type: 'screen',\n};\n`);
        t.apply({
            execute: { code: '  ', description: 'Later.' },
            items: [{ condition: { code: '', description: 'Always.' } }],
        });
        expect(t.read()).toEqual({
            execute: { code: '() => {}', description: 'Later.' },
            items: [{ condition: { code: 'true', description: 'Always.' } }],
        });
        t.apply({ execute: null, items: [] });
        const text = t.sf.getFullText();
        expect(text).not.toContain('Later.');
        expect(text).not.toContain('execute');
        expect(t.read()).toEqual({ items: [] });
    });

    it('refuses a value that is not { code, description? }', () => {
        const t = setup(`const x = {\n    id: 'a',\n};\n`);
        expect(() => t.apply({ execute: true })).toThrow(/must be \{ code, description\? \}/);
        expect(() => t.apply({ execute: { code: '() => {}', other: 1 } })).toThrow(/must be \{ code, description\? \}/);
    });
});
