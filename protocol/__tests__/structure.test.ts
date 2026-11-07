import { describe, expect, it } from 'vitest';
import {
    inferTypeRef,
    refIdTypeName,
    refNameAmong,
    refNameOfIdType,
    refTarget,
    structNameError,
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
            kind: 'class',
            origin: 'story',
            fields: [{ key: 'name', type: { t: 'string' }, optional: false }],
            catalog: { name: 'races', file: 'data/catalogs/races.ts', idType: 'TRaceId' },
        },
        { version: 't2', file: 'types/TBag.ts', name: 'TBag', kind: 'type', origin: 'story', fields: [] },
        {
            version: 't3',
            file: 'types/TStats.ts',
            name: 'TStats',
            kind: 'type',
            origin: 'story',
            fields: [
                { key: 'hp', type: { t: 'number' }, optional: false },
                { key: 'mood', type: { t: 'literal', name: 'TMood' }, optional: false },
                { key: 'luck', type: { t: 'number' }, optional: true },
            ],
        },
        {
            version: 't4',
            file: 'types/TNode.ts',
            name: 'TNode',
            kind: 'type',
            origin: 'story',
            fields: [
                { key: 'value', type: { t: 'number' }, optional: false },
                { key: 'next', type: { t: 'struct', name: 'TNode' }, optional: false },
            ],
        },
    ],
    diagnostics: [],
};

const IDS: Record<string, string[]> = { TRace: ['elf', 'dwarf'], Location: [] };

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
        [{ t: 'ref', name: 'Location' }, ''],
        [{ t: 'array', of: { t: 'number' } }, []],
        [
            { t: 'struct', name: 'TStats' },
            { hp: 0, mood: 'happy' },
        ],
        [{ t: 'struct', name: 'TBag' }, {}],
        [{ t: 'struct', name: 'TRace' }, {}],
        [{ t: 'struct', name: 'TMissing' }, {}],
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

    it('stops at a recursive story type instead of looping', () => {
        expect(typeDefault({ t: 'struct', name: 'TNode' }, CTX)).toEqual({ value: 0, next: null });
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
        expect(refTarget('Location', STRUCTURE)).toEqual({ source: 'entities', kind: 'locations' });
        expect(refTarget('TChapter', STRUCTURE)).toEqual({ source: 'chapters' });
        expect(refTarget('TRace', STRUCTURE)).toEqual({ source: 'catalog', catalog: 'races' });
        expect(refTarget('TBag', STRUCTURE)).toBeNull();
        expect(refTarget('TMissing', STRUCTURE)).toBeNull();
    });

    it('writes the id type of a class and of a prefixed built-in', () => {
        expect(refIdTypeName('Race')).toBe('TRaceId');
        expect(refIdTypeName('Character')).toBe('TCharacterId');
        expect(refIdTypeName('TItem')).toBe('TItemId');
        expect(refIdTypeName('TChapter')).toBe('TChapterId');
        expect(refIdTypeName('TRace')).toBe('TRaceId');
    });

    it('reads the class of an id type, keeping the prefixed built-ins', () => {
        expect(refNameOfIdType('TRaceId')).toBe('Race');
        expect(refNameOfIdType('TLocationId')).toBe('Location');
        expect(refNameOfIdType('TItemId')).toBe('TItem');
        expect(refNameOfIdType('TChapterId')).toBe('TChapter');
        expect(refNameOfIdType('TRace')).toBeNull();
        expect(refNameOfIdType('RaceId')).toBeNull();
        expect(refNameOfIdType('Id')).toBeNull();
    });

    it('finds the ref name of an id type among known names, whichever naming they use', () => {
        expect(refNameAmong('TRaceId', ['Location', 'Race'])).toBe('Race');
        expect(refNameAmong('TLocationId', ['Location', 'Race'])).toBe('Location');
        expect(refNameAmong('TClanId', ['Location', 'Race'])).toBeUndefined();
    });
});

describe('structNameError', () => {
    const TAKEN = ['TMood', 'Race'];

    it.each<[string, ReturnType<typeof structNameError>]>([
        ['', 'required'],
        ['Clan', null],
        ['Character', null],
        ['Race', 'taken'],
        ['TClan', 'pattern'],
        ['clan', 'pattern'],
        ['Clan_1', 'pattern'],
        ['Item', 'reserved'],
        ['Chapter', 'reserved'],
    ])('class %j → %j', (name, expected) => {
        expect(structNameError(name, TAKEN, 'class')).toBe(expected);
    });

    it.each<[string, ReturnType<typeof structNameError>]>([
        ['', 'required'],
        ['TData', null],
        ['TMood', 'taken'],
        ['Data', 'pattern'],
        ['TDataId', 'id'],
        ['TItem', null],
    ])('type %j → %j', (name, expected) => {
        expect(structNameError(name, TAKEN, 'type')).toBe(expected);
    });
});
