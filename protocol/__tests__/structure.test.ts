import { describe, expect, it } from 'vitest';
import {
    inferTypeRef,
    refIdTypeName,
    refNameOfIdType,
    refTarget,
    typeDefault,
    typeDefaultContext,
    UNKNOWN_TYPE_REF,
    type TStructureDto,
    type TTypeDefaultContext,
    type TTypeRef,
} from '../src';

const STRUCTURE: TStructureDto = {
    version: 'v1',
    literals: [
        { version: 'l1', file: 'types/literals.ts', name: 'TMood', scope: 'global', values: ['happy', 'sad'] },
        { version: 'l2', file: 'types/literals.ts', name: 'TEmpty', scope: 'global', values: [] },
    ],
    types: [
        {
            version: 't1',
            file: 'types/TRace.ts',
            name: 'TRace',
            origin: 'story',
            fields: [{ key: 'name', type: { t: 'string' }, optional: false }],
            catalog: { name: 'races', file: 'data/catalogs/races.ts', idType: 'TRaceId' },
        },
        { version: 't2', file: 'types/TBag.ts', name: 'TBag', origin: 'story', fields: [] },
    ],
    diagnostics: [],
};

const IDS: Record<string, string[]> = { TRace: ['elf', 'dwarf'], TLocation: [] };

const CTX: TTypeDefaultContext = typeDefaultContext(STRUCTURE, (name) => IDS[name] ?? []);

describe('typeDefault', () => {
    it.each<[TTypeRef, unknown]>([
        [{ t: 'string' }, ''],
        [{ t: 'number' }, 0],
        [{ t: 'boolean' }, false],
        [{ t: 'literal', name: 'TMood' }, 'happy'],
        [{ t: 'literal', name: 'TEmpty' }, ''],
        [{ t: 'literal', name: 'TMissing' }, ''],
        [{ t: 'ref', name: 'TRace' }, 'elf'],
        [{ t: 'ref', name: 'TLocation' }, ''],
        [{ t: 'array', of: { t: 'number' } }, []],
        [{ t: 'function', signature: '() => void' }, { code: '() => {}' }],
        [{ t: 'code', code: 'Time' }, null],
    ])('%j → %j', (ref, expected) => {
        expect(typeDefault(ref, CTX)).toEqual(expected);
    });

    it('fills only the required fields of an object, recursively', () => {
        const ref: TTypeRef = {
            t: 'object',
            fields: [
                { key: 'name', type: { t: 'string' }, optional: false },
                { key: 'nick', type: { t: 'string' }, optional: true },
                { key: 'race', type: { t: 'ref', name: 'TRace' }, optional: false },
                {
                    key: 'stats',
                    type: {
                        t: 'object',
                        fields: [
                            { key: 'mood', type: { t: 'literal', name: 'TMood' }, optional: false },
                            { key: 'luck', type: { t: 'number' }, optional: true },
                        ],
                    },
                    optional: false,
                },
            ],
        };
        expect(typeDefault(ref, CTX)).toEqual({ name: '', race: 'elf', stats: { mood: 'happy' } });
    });
});

describe('inferTypeRef', () => {
    it('infers primitives', () => {
        expect(inferTypeRef('a')).toEqual({ t: 'string' });
        expect(inferTypeRef(1)).toEqual({ t: 'number' });
        expect(inferTypeRef(true)).toEqual({ t: 'boolean' });
    });

    it('treats code and null as unknown', () => {
        expect(inferTypeRef({ code: "_('Hi')" })).toEqual(UNKNOWN_TYPE_REF);
        expect(inferTypeRef(null)).toEqual(UNKNOWN_TYPE_REF);
    });

    it('infers an array item type only when every item agrees', () => {
        expect(inferTypeRef([1, 2])).toEqual({ t: 'array', of: { t: 'number' } });
        expect(inferTypeRef([1, 'a'])).toEqual({ t: 'array', of: UNKNOWN_TYPE_REF });
        expect(inferTypeRef([])).toEqual({ t: 'array', of: UNKNOWN_TYPE_REF });
    });

    it('infers objects field by field, all required', () => {
        expect(inferTypeRef({ id: 'axe', amount: 2, tags: ['sharp'] })).toEqual({
            t: 'object',
            fields: [
                { key: 'id', type: { t: 'string' }, optional: false },
                { key: 'amount', type: { t: 'number' }, optional: false },
                { key: 'tags', type: { t: 'array', of: { t: 'string' } }, optional: false },
            ],
        });
    });
});

describe('refs', () => {
    it('maps built-in and catalog types to their id source', () => {
        expect(refTarget('TLocation', STRUCTURE)).toEqual({ source: 'entities', kind: 'locations' });
        expect(refTarget('TChapter', STRUCTURE)).toEqual({ source: 'chapters' });
        expect(refTarget('TRace', STRUCTURE)).toEqual({ source: 'catalog', catalog: 'races' });
        expect(refTarget('TBag', STRUCTURE)).toBeNull();
        expect(refTarget('TMissing', STRUCTURE)).toBeNull();
    });

    it('converts between a ref name and its id type', () => {
        expect(refIdTypeName('TRace')).toBe('TRaceId');
        expect(refNameOfIdType('TRaceId')).toBe('TRace');
        expect(refNameOfIdType('TRace')).toBeNull();
        expect(refNameOfIdType('Id')).toBeNull();
    });
});
