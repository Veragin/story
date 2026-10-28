import { useState } from 'react';
import { styled, Typography } from '@mui/material';
import { spacingCss } from '@story/ui';
import type {
    TFieldDesc,
    TFunctionDto,
    TMaybeCode,
    TValue,
    TValueRecord,
} from '@story/protocol';
import { FormArrayEditor } from '../components/editors/FormArrayEditor';
import { FormCheckbox } from '../components/form/FormCheckbox';
import { FormFunctionEditor } from '../components/editors/FormFunctionEditor';
import { FormNumberInput } from '../components/form/FormNumberInput';
import { FormObjectEditor } from '../components/editors/FormObjectEditor';
import { FormTextInput } from '../components/form/FormTextInput';
import { FormMaybeCodeTextInput } from '../components/code/FormMaybeCodeTextInput';
import { FormStructureEditor } from '../components/editors/FormStructureEditor';
import { FormAutocompleteInput } from '../components/form/FormAutocompleteInput';
import { FormFields } from '../components/form/FormFields';
import { optionsOf } from '../structure/option';
import { StructureContext } from '../structure/structureContext';
import {
    structureRows,
    type TNewLiteral,
    type TStructureRow,
} from '../structure/structureRows';
import { OPTIONS, sampleStructure, STRUCTURE } from './sampleStructure';

// untranslated: developer-only tool

const INIT_FIELDS: TFieldDesc[] = [
    {
        key: 'location',
        type: { t: 'ref', name: 'TLocation' },
        optional: false,
        locked: true,
    },
    { key: 'health', type: { t: 'number' }, optional: false, locked: true },
    {
        key: 'inventory',
        type: {
            t: 'array',
            of: {
                t: 'object',
                fields: [
                    {
                        key: 'id',
                        type: { t: 'ref', name: 'TItem' },
                        optional: false,
                    },
                    { key: 'amount', type: { t: 'number' }, optional: true },
                ],
            },
        },
        optional: true,
    },
    {
        key: 'mood',
        type: { t: 'literal', name: 'TMood' },
        optional: true,
        description: 'How the character feels',
    },
    { key: 'race', type: { t: 'ref', name: 'TRace' }, optional: true },
];

type TState = {
    name: string | undefined;
    description: TMaybeCode<string> | undefined;
    health: number | undefined;
    awake: boolean | undefined;
    type: string | undefined;
    location: string | undefined;
    sublocations: TMaybeCode<TValue[]> | undefined;
    init: TMaybeCode<TValueRecord> | undefined;
    props: TMaybeCode<TValueRecord> | undefined;
    execute: TFunctionDto | undefined;
    structure: readonly TStructureRow[] | undefined;
};

const INITIAL: TState = {
    name: 'Annie',
    description: { code: "_('A girl from the village')" },
    health: 10,
    awake: true,
    type: 'tool',
    location: 'forest',
    sublocations: ['village'],
    init: {
        location: 'forest',
        health: 10,
        inventory: [{ id: 'axe', amount: 1 }],
    },
    props: { dmg: 3, sharp: true },
    execute: undefined,
    structure: structureRows([
        { key: 'id', type: { t: 'string' }, optional: false, locked: true },
        ...INIT_FIELDS.slice(2),
    ]),
};

export const InputsPlayground = () => {
    const [state, setState] = useState(INITIAL);
    const [itemTypes, setItemTypes] = useState(['value', 'tool', 'food']);
    const [newLiterals, setNewLiterals] = useState<TNewLiteral[]>([]);
    const [structure] = useState(() => sampleStructure());
    const set =
        <K extends keyof TState>(key: K) =>
        (value: TState[K]) =>
            setState((old) => ({ ...old, [key]: value }));

    const addItemType = (value: string) => {
        setItemTypes((old) => [...old, value]);
        return Promise.resolve(true);
    };

    return (
        <StructureContext.Provider value={structure}>
            <SRoot>
                <SForm>
                    <Typography variant="h6">Inputs playground</Typography>
                    <FormTextInput
                        label="Name"
                        value={state.name}
                        onChange={set('name')}
                    />
                    <FormMaybeCodeTextInput
                        label="Description"
                        value={state.description}
                        onChange={set('description')}
                        multiline
                        optional
                        helperText="Code shows read-only, with Convert"
                    />
                    <FormNumberInput
                        label="Health"
                        value={state.health}
                        onChange={set('health')}
                    />
                    <FormCheckbox
                        label="Awake"
                        value={state.awake}
                        onChange={set('awake')}
                        optional
                    />
                    <FormAutocompleteInput
                        label="Type"
                        value={state.type}
                        onChange={set('type')}
                        options={optionsOf(itemTypes)}
                        onCreateOption={addItemType}
                    />
                    <FormAutocompleteInput
                        label="Location"
                        value={state.location}
                        onChange={set('location')}
                        options={OPTIONS.TLocation}
                    />
                    <FormArrayEditor
                        label="sublocations"
                        value={state.sublocations}
                        onChange={set('sublocations')}
                        itemType={{ t: 'ref', name: 'TLocation' }}
                    />
                    <FormObjectEditor
                        label="init"
                        value={state.init}
                        onChange={set('init')}
                        fields={INIT_FIELDS}
                        diagnosticsOf={(path) =>
                            path === 'health'
                                ? [
                                      {
                                          file: 'data/characters/annie.ts',
                                          line: 7,
                                          column: 9,
                                          message: 'Example.',
                                      },
                                  ]
                                : []
                        }
                    />
                    <FormObjectEditor
                        label="props"
                        value={state.props}
                        onChange={set('props')}
                        optional
                        allowCustomFields
                    />
                    <FormFunctionEditor
                        label="execute"
                        value={state.execute}
                        onChange={set('execute')}
                        optional
                        emptyCode="() => {}"
                    />
                    <FormStructureEditor
                        label="TCharacter"
                        value={state.structure}
                        onChange={set('structure')}
                        literals={{
                            file: STRUCTURE.literals[0].file,
                            newLiterals,
                            onNewLiteral: (literal) =>
                                setNewLiterals((old) => [...old, literal]),
                        }}
                    />
                </SForm>
                <SState>
                    {JSON.stringify({ state, itemTypes, newLiterals }, null, 2)}
                </SState>
            </SRoot>
        </StructureContext.Provider>
    );
};

const SRoot = styled('div')`
    display: flex;
    flex-wrap: wrap;
    gap: ${spacingCss(2)};
    padding: ${spacingCss(2)};
    overflow: auto;
    height: 100%;
    box-sizing: border-box;
`;

const SForm = styled(FormFields)`
    flex: 2 1 480px;
`;

const SState = styled('pre')`
    flex: 1 1 280px;
    margin: 0;
    font-size: 11px;
    opacity: 0.8;
    white-space: pre-wrap;
`;
