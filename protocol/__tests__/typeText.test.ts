import { describe, expect, it } from 'vitest';
import { fieldTypeNames, objectTypeText, refToTypeText } from '../src';

describe('typeText', () => {
    it('writes field types', () => {
        expect(refToTypeText({ t: 'ref', name: 'TRace' })).toBe('TRaceId');
        expect(refToTypeText({ t: 'ref', name: 'Race' })).toBe('TRaceId');
        expect(refToTypeText({ t: 'struct', name: 'TData' })).toBe('TData');
        expect(refToTypeText({ t: 'array', of: { t: 'struct', name: 'TData' } })).toBe('TData[]');
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
        expect(
            objectTypeText([
                { key: 'ch', type: { t: 'ref', name: 'Character' }, optional: false },
                { key: 'd', type: { t: 'struct', name: 'TData' }, optional: true },
            ])
        ).toBe('{ ch: TCharacterId; d?: TData }');
    });

    it('names the types the text mentions', () => {
        expect(
            fieldTypeNames([
                { key: 'ch', type: { t: 'ref', name: 'Character' }, optional: false },
                { key: 'd', type: { t: 'array', of: { t: 'struct', name: 'TData' } }, optional: false },
                { key: 'm', type: { t: 'literal', name: 'TMood' }, optional: false },
                { key: 'e', type: { t: 'struct', name: 'TData' }, optional: false },
            ])
        ).toEqual(['TCharacterId', 'TData', 'TMood']);
    });
});
