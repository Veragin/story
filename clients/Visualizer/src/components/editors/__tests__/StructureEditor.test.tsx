import '@story/shared'; // installs the global `_`
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TFieldDesc, TStructureDto } from '@story/protocol';
import { STRUCTURE } from '../../../dev/sampleStructure';
import { staticStructureContext } from '../../../structure/structureContext';
import { StructureEditor } from '../StructureEditor/StructureEditor';
import {
    rowFields,
    rowRenames,
    structureRows,
    type TNewLiteral,
    type TStructureRow,
} from '../../../structure/structureRows';
import {
    $,
    $$,
    click,
    fire,
    get,
    mount,
    selectOption,
    typeInto,
    unmount,
} from '../../inputs/__tests__/dom';
import { Controlled, InStructure } from '../../inputs/__tests__/harness';

const FIELDS: TFieldDesc[] = [
    { key: 'id', type: { t: 'string' }, optional: false, locked: true },
    { key: 'energy', type: { t: 'number' }, optional: false },
    { key: 'race', type: { t: 'ref', name: 'Race' }, optional: true },
];

describe('StructureEditor', () => {
    afterEach(unmount);

    const render = (
        fields: TFieldDesc[],
        onNewLiteral?: (literal: TNewLiteral) => void
    ) => {
        const onChange = vi.fn<(rows: TStructureRow[]) => void>();
        mount(
            <InStructure>
                <Controlled initial={structureRows(fields)} onChange={onChange}>
                    {(value, change) => (
                        <StructureEditor
                            value={value}
                            onChange={change}
                            literals={{
                                file: 'data/items/itemInfo.ts',
                                onNewLiteral,
                            }}
                            ariaLabel="Character"
                        />
                    )}
                </Controlled>
            </InStructure>
        );
        return () => onChange.mock.lastCall?.[0] ?? [];
    };

    const row = (key: string) => get(`[data-key="${key}"]`);
    const keyInput = (key: string) =>
        get<HTMLInputElement>(`[data-key="${key}"] [data-field="field-key"]`);

    it('shows a locked row read-only, with the engine hint', () => {
        render(FIELDS);
        expect(row('id').getAttribute('data-locked')).toBe('true');
        expect(keyInput('id').disabled).toBe(true);
        expect(get<HTMLSelectElement>('[data-key="id"] select').disabled).toBe(
            true
        );
        expect(
            get<HTMLButtonElement>('[data-key="id"] [data-action="remove-row"]')
                .disabled
        ).toBe(true);
        expect(
            $('[data-key="id"] [aria-label="Used by the engine"]')
        ).not.toBeNull();
        expect(row('energy').getAttribute('data-locked')).toBeNull();
        expect(keyInput('energy').disabled).toBe(false);
    });

    it('tracks a rename by the original key', () => {
        const last = render(FIELDS);
        typeInto(keyInput('energy'), 'stamina');
        expect(rowRenames(last())).toEqual({ energy: 'stamina' });
        expect(rowFields(last()).map((field) => field.key)).toEqual([
            'id',
            'stamina',
            'race',
        ]);
        typeInto(keyInput('stamina'), 'energy');
        expect(rowRenames(last())).toEqual({});
    });

    it('does not report a new or moved field as a rename', () => {
        const last = render(FIELDS);
        click('[data-action="add-structure-field"]');
        expect(last()[3]).toEqual({
            field: { key: 'field', type: { t: 'string' }, optional: false },
            originalKey: null,
        });
        typeInto(keyInput('field'), 'mood');
        act(() => get('[data-key="race"] [data-action="move-down"]').click());
        expect(rowFields(last()).map((field) => field.key)).toEqual([
            'id',
            'energy',
            'mood',
            'race',
        ]);
        expect(rowRenames(last())).toEqual({});
    });

    it('flags a duplicate key', () => {
        render(FIELDS);
        typeInto(keyInput('energy'), 'race');
        expect(document.body.textContent).toContain('Already there');
    });

    it('changes the type and the optional flag', () => {
        const last = render(FIELDS);
        selectOption(
            get<HTMLSelectElement>('select[aria-label="energy type"]'),
            'array'
        );
        expect(last()[1].field.type).toEqual({
            t: 'array',
            of: { t: 'string' },
        });
        act(() =>
            get<HTMLInputElement>(
                'input[aria-label="energy is optional"]'
            ).click()
        );
        expect(last()[1].field.optional).toBe(true);
    });

    const openList = (selector: string) => {
        const input = get<HTMLInputElement>(selector);
        act(() => input.focus());
        fire(
            input,
            new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
        );
    };
    const shownOptions = () =>
        $$('[data-option]').map((li) => li.getAttribute('data-option'));

    it('offers class and type kinds, with the classes and the visible story types', () => {
        const last = render(FIELDS);
        const kinds = get<HTMLSelectElement>(
            'select[aria-label="energy type"]'
        );
        expect(
            [...kinds.options].map((option) => [option.value, option.text])
        ).toEqual([
            ['string', 'string'],
            ['number', 'number'],
            ['boolean', 'boolean'],
            ['literal', 'literal'],
            ['ref', 'class'],
            ['struct', 'type'],
            ['array', 'array of'],
            ['object', 'object'],
            ['function', 'function'],
        ]);

        selectOption(kinds, 'ref');
        expect(last()[1].field.type).toEqual({ t: 'ref', name: 'Location' });
        openList('input[aria-label="energy class"]');
        expect(shownOptions()).toEqual([
            'Location',
            'Character',
            'Npc',
            'TItem',
            'TChapter',
            'Race',
        ]);
        click('[data-option="Race"]');
        expect(last()[1].field.type).toEqual({ t: 'ref', name: 'Race' });

        selectOption(kinds, 'struct');
        expect(last()[1].field.type).toEqual({ t: 'struct', name: 'TStats' });
        openList('input[aria-label="energy type name"]');
        expect(shownOptions()).toEqual(['TStats']);
    });

    it('creates a new local literal from the literal picker', () => {
        const onNewLiteral = vi.fn();
        const last = render(FIELDS, onNewLiteral);
        selectOption(
            get<HTMLSelectElement>('select[aria-label="energy type"]'),
            'literal'
        );
        expect(last()[1].field.type).toEqual({ t: 'literal', name: 'TMood' });

        const picker = get<HTMLInputElement>(
            'input[aria-label="energy literal"]'
        );
        typeInto(picker, 'TItemType');
        expect($('[data-create]')).toBeNull();
        typeInto(picker, 'TFeeling');
        click('[data-create="TFeeling"]');
        const values = get<HTMLInputElement>(
            'input[aria-label="Values of TFeeling"]'
        );
        typeInto(values, 'happy');
        fire(
            values,
            new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
        );
        click('[data-action="create-literal"]');
        expect(onNewLiteral).toHaveBeenCalledWith({
            name: 'TFeeling',
            values: ['happy'],
        });
        expect(last()[1].field.type).toEqual({
            t: 'literal',
            name: 'TFeeling',
        });
    });

    it('refuses an invalid new literal name', () => {
        render(FIELDS, vi.fn());
        selectOption(
            get<HTMLSelectElement>('select[aria-label="energy type"]'),
            'literal'
        );
        typeInto(
            get<HTMLInputElement>('input[aria-label="energy literal"]'),
            'feeling'
        );
        click('[data-create="feeling"]');
        expect(document.body.textContent).toContain(
            'A name starts with T and a capital letter'
        );
        expect($('[data-new-literal]')).toBeNull();
    });

    describe('private members of a class', () => {
        const PRIVATE: TStructureDto = {
            ...STRUCTURE,
            literals: [
                ...STRUCTURE.literals,
                {
                    name: 'TRaceTone',
                    scope: 'private',
                    owner: 'Race',
                    file: 'types/Race.ts',
                    version: 'v1',
                    values: ['low', 'high'],
                },
            ],
            types: [
                ...STRUCTURE.types,
                {
                    name: 'TRaceTrait',
                    kind: 'type',
                    origin: 'story',
                    owner: 'Race',
                    file: 'types/Race.ts',
                    version: 'v1',
                    fields: [],
                },
            ],
        };

        const renderIn = (file: string, owner?: string) => {
            const onChange = vi.fn<(rows: TStructureRow[]) => void>();
            mount(
                <InStructure structure={staticStructureContext(PRIVATE)}>
                    <Controlled
                        initial={structureRows(FIELDS)}
                        onChange={onChange}
                    >
                        {(value, change) => (
                            <StructureEditor
                                value={value}
                                onChange={change}
                                literals={{
                                    file,
                                    owner,
                                    onNewLiteral: vi.fn(),
                                }}
                                ariaLabel="Character"
                            />
                        )}
                    </Controlled>
                </InStructure>
            );
        };

        const optionsOfKind = (kind: 'literal' | 'struct', input: string) => {
            selectOption(
                get<HTMLSelectElement>('select[aria-label="energy type"]'),
                kind
            );
            openList(`input[aria-label="${input}"]`);
            return shownOptions();
        };

        it('offers them inside the class file', () => {
            renderIn('types/Race.ts', 'Race');
            expect(optionsOfKind('struct', 'energy type name')).toEqual([
                'TStats',
                'TRaceTrait',
            ]);
            unmount();
            renderIn('types/Race.ts', 'Race');
            expect(optionsOfKind('literal', 'energy literal')).toEqual([
                'TMood',
                'TRaceTone',
            ]);
            typeInto(
                get<HTMLInputElement>('input[aria-label="energy literal"]'),
                'TFeeling'
            );
            expect(get('[data-create="TFeeling"]').textContent).toContain(
                'New private literal TFeeling'
            );
        });

        it('does not offer them elsewhere, e.g. in an entity data type', () => {
            renderIn('data/characters/hero.ts');
            expect(optionsOfKind('struct', 'energy type name')).toEqual([
                'TStats',
            ]);
            unmount();
            renderIn('data/characters/hero.ts');
            expect(optionsOfKind('literal', 'energy literal')).toEqual([
                'TMood',
            ]);
        });
    });
});
