import { describe, expect, it } from 'vitest';
import { objectTypeText, refToTypeText } from '../src';

describe('typeText', () => {
    it('writes field types', () => {
        expect(refToTypeText({ t: 'ref', name: 'TRace' })).toBe('TRaceId');
        expect(refToTypeText({ t: 'array', of: { t: 'function', signature: '() => void' } })).toBe('(() => void)[]');
        expect(refToTypeText({ t: 'code', code: 'Partial<X>' })).toBe('Partial<X>');
    });

    it('writes an object type', () => {
        expect(objectTypeText([])).toBe('{}');
        expect(
            objectTypeText([
                { key: 'knowsMagic', type: { t: 'boolean' }, optional: false },
                { key: "it's", type: { t: 'literal', name: 'TMood' }, optional: true },
            ])
        ).toBe("{ knowsMagic: boolean; 'it\\'s'?: TMood }");
        expect(objectTypeText([{ key: 'a', type: { t: 'number' }, optional: false, description: 'Count' }])).toBe(
            '{\n/** Count */\na: number;\n}'
        );
    });
});
