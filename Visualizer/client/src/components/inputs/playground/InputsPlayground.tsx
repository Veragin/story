import { useState } from 'react';
import { styled, Typography } from '@mui/material';
import { spacingCss } from '@story/ui';
import type {
    TFieldDesc,
    TFunctionDto,
    TMaybeCode,
    TValue,
    TValueRecord,
} from '@story/visualizer-protocol';
import { FormArrayInput } from '../form/FormArrayInput';
import { FormBooleanInput } from '../form/FormBooleanInput';
import { FormFunctionInput } from '../form/FormFunctionInput';
import { FormLiteralInput } from '../form/FormLiteralInput';
import { FormNumberInput } from '../form/FormNumberInput';
import { FormObjectInput } from '../form/FormObjectInput';
import { FormStringInput } from '../form/FormStringInput';
import { FormStructureInput } from '../form/FormStructureInput';
import { FormTypeInput } from '../form/FormTypeInput';
import { StructureContext } from '../structureContext';
import {
    structureRows,
    type TNewLiteral,
    type TStructureRow,
} from '../StructureInput/structureRows';
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
    name: TMaybeCode<string> | undefined;
    description: TMaybeCode<string> | undefined;
    health: TMaybeCode<number> | undefined;
    awake: TMaybeCode<boolean> | undefined;
    type: TMaybeCode<string> | undefined;
    location: TMaybeCode<string> | undefined;
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
                    <FormStringInput
                        label="name"
                        value={state.name}
                        onChange={set('name')}
                    />
                    <FormStringInput
                        label="description"
                        value={state.description}
                        onChange={set('description')}
                        multiline
                        optional
                        helperText="Code shows read-only, with Convert"
                    />
                    <FormNumberInput
                        label="health"
                        value={state.health}
                        onChange={set('health')}
                    />
                    <FormBooleanInput
                        label="awake"
                        value={state.awake}
                        onChange={set('awake')}
                        optional
                    />
                    <FormLiteralInput
                        label="type"
                        value={state.type}
                        onChange={set('type')}
                        options={itemTypes}
                        onCreateOption={addItemType}
                    />
                    <FormTypeInput
                        label="location"
                        value={state.location}
                        onChange={set('location')}
                        options={OPTIONS.TLocation}
                    />
                    <FormArrayInput
                        label="sublocations"
                        value={state.sublocations}
                        onChange={set('sublocations')}
                        itemType={{ t: 'ref', name: 'TLocation' }}
                    />
                    <FormObjectInput
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
                    <FormObjectInput
                        label="props"
                        value={state.props}
                        onChange={set('props')}
                        optional
                        allowCustomFields
                    />
                    <FormFunctionInput
                        label="execute"
                        value={state.execute}
                        onChange={set('execute')}
                        optional
                        emptyCode="() => {}"
                    />
                    <FormStructureInput
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

const SForm = styled('div')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(1.5)};
    flex: 2 1 480px;
    min-width: 0;
`;

const SState = styled('pre')`
    flex: 1 1 280px;
    margin: 0;
    font-size: 11px;
    opacity: 0.8;
    white-space: pre-wrap;
`;
