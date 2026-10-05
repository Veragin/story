import { useState } from 'react';
import { styled, TextField, Typography } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { spacingCss } from '@story/ui';
import { structNameError, type TTypeRef } from '@story/visualizer-protocol';
import type { TOption } from '../inputTypes';
import { OptionAutocomplete } from '../OptionAutocomplete';
import { useStructureContext } from '../structureContext';
import { NewLiteralEditor } from './NewLiteralEditor';
import { StructureInput } from './StructureInput';
import {
    rowFields,
    structNameMessage,
    structureRows,
    type TLiteralDraft,
} from './structureRows';

type TTypeKind = TTypeRef['t'];

const KINDS: TTypeKind[] = [
    'string',
    'number',
    'boolean',
    'literal',
    'ref',
    'array',
    'object',
    'function',
];

const KIND_LABEL: Record<TTypeKind, () => string> = {
    string: () => _('string'),
    number: () => _('number'),
    boolean: () => _('boolean'),
    literal: () => _('literal'),
    ref: () => _('type'),
    array: () => _('array of'),
    object: () => _('object'),
    function: () => _('function'),
    code: () => _('code'),
};

const isTypeKind = (kind: string): kind is TTypeKind =>
    kind === 'code' || KINDS.some((known) => known === kind);

type TProps = {
    value: TTypeRef;
    onChange: (value: TTypeRef) => void;
    literals?: TLiteralDraft;
    disabled?: boolean;
    ariaLabel: string;
};

type TPending = { name: string; error: string | null };

export const FieldTypePicker = observer(
    ({ value, onChange, literals = {}, disabled, ariaLabel }: TProps) => {
        const structure = useStructureContext();
        const [pending, setPending] = useState<TPending | null>(null);
        const newLiterals = literals.newLiterals ?? [];
        const visible = structure.literalsVisibleFrom(literals.file);
        const globals = new Set(
            visible.filter((l) => l.scope === 'global').map((l) => l.name)
        );
        const literalOptions: TOption[] = [
            ...visible.filter((l) => l.scope === 'global'),
            ...visible.filter((l) => l.scope === 'local'),
            ...newLiterals,
        ].map((literal) => ({ id: literal.name }));

        const defaultOf = (kind: TTypeKind): TTypeRef => {
            switch (kind) {
                case 'string':
                case 'number':
                case 'boolean':
                    return { t: kind };
                case 'literal':
                    return { t: 'literal', name: literalOptions[0]?.id ?? '' };
                case 'ref':
                    return { t: 'ref', name: structure.refTypeNames[0] ?? '' };
                case 'array':
                    return { t: 'array', of: { t: 'string' } };
                case 'object':
                    return { t: 'object', fields: [] };
                case 'function':
                    return { t: 'function', signature: '() => void' };
                case 'code':
                    return value;
            }
        };

        const startNewLiteral = (name: string) => {
            const taken = [
                ...structure.literalNames,
                ...structure.typeNames,
                ...newLiterals.map((literal) => literal.name),
            ];
            const error = structNameError(name, taken);
            setPending({
                name,
                error: error ? structNameMessage(error) : null,
            });
            // the literal is created by the inline editor, not by the pick
            return Promise.resolve(false);
        };

        const onNewLiteral = literals.onNewLiteral;

        return (
            <SPicker data-type-kind={value.t}>
                <SLine>
                    <TextField
                        select
                        size="small"
                        value={value.t}
                        disabled={disabled}
                        slotProps={{
                            select: { native: true },
                            htmlInput: {
                                'aria-label': _('%s type', ariaLabel),
                                'data-field': 'type-kind',
                            },
                        }}
                        onChange={(e) => {
                            if (isTypeKind(e.target.value))
                                onChange(defaultOf(e.target.value));
                        }}
                        sx={{ minWidth: 120 }}
                    >
                        {KINDS.map((kind) => (
                            <option key={kind} value={kind}>
                                {KIND_LABEL[kind]()}
                            </option>
                        ))}
                        {value.t === 'code' && (
                            <option value="code" disabled>
                                {KIND_LABEL.code()}
                            </option>
                        )}
                    </TextField>
                    {value.t === 'literal' && (
                        <OptionAutocomplete
                            value={value.name}
                            onChange={(name) =>
                                onChange({ t: 'literal', name })
                            }
                            options={literalOptions}
                            groupOf={(option) =>
                                globals.has(option.id)
                                    ? _('Global')
                                    : _('This file')
                            }
                            onCreateOption={
                                onNewLiteral ? startNewLiteral : undefined
                            }
                            createLabel={(name) =>
                                _('+ New local literal %s', name)
                            }
                            hasError={value.name === ''}
                            disabled={disabled}
                            ariaLabel={_('%s literal', ariaLabel)}
                        />
                    )}
                    {value.t === 'ref' && (
                        <OptionAutocomplete
                            value={value.name}
                            onChange={(name) => onChange({ t: 'ref', name })}
                            options={structure.refTypeNames.map((id) => ({
                                id,
                            }))}
                            hasError={value.name === ''}
                            disabled={disabled}
                            ariaLabel={_('%s referenced type', ariaLabel)}
                        />
                    )}
                    {value.t === 'function' && (
                        <TextField
                            size="small"
                            fullWidth
                            value={value.signature}
                            disabled={disabled}
                            slotProps={{
                                htmlInput: {
                                    'aria-label': _('%s signature', ariaLabel),
                                },
                            }}
                            onChange={(e) =>
                                onChange({
                                    t: 'function',
                                    signature: e.target.value,
                                })
                            }
                        />
                    )}
                    {value.t === 'code' && <SCode>{value.code}</SCode>}
                </SLine>
                {pending &&
                    (pending.error ? (
                        <Typography variant="caption" color="error">
                            {pending.error}
                        </Typography>
                    ) : (
                        onNewLiteral && (
                            <NewLiteralEditor
                                name={pending.name}
                                onCancel={() => setPending(null)}
                                onCreate={(values) => {
                                    onNewLiteral({
                                        name: pending.name,
                                        values,
                                    });
                                    onChange({
                                        t: 'literal',
                                        name: pending.name,
                                    });
                                    setPending(null);
                                }}
                            />
                        )
                    ))}
                {value.t === 'array' && (
                    <SNested>
                        <FieldTypePicker
                            value={value.of}
                            onChange={(of) => onChange({ t: 'array', of })}
                            literals={literals}
                            disabled={disabled}
                            ariaLabel={_('%s item', ariaLabel)}
                        />
                    </SNested>
                )}
                {value.t === 'object' && (
                    <SNested>
                        <StructureInput
                            value={structureRows(value.fields)}
                            onChange={(rows) =>
                                onChange({
                                    t: 'object',
                                    fields: rowFields(rows),
                                })
                            }
                            literals={literals}
                            disabled={disabled}
                            ariaLabel={_('%s fields', ariaLabel)}
                        />
                    </SNested>
                )}
            </SPicker>
        );
    }
);

const SPicker = styled('div')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(0.5)};
    flex: 1 1 220px;
    min-width: 0;
`;

const SLine = styled('div')`
    display: flex;
    align-items: flex-start;
    gap: ${spacingCss(0.5)};
`;

const SNested = styled('div')`
    padding-left: ${spacingCss(1)};
    border-left: 2px solid rgba(255, 255, 255, 0.12);
`;

const SCode = styled('code')`
    padding: ${spacingCss(1)};
    font-family: 'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace;
    font-size: 12px;
    color: #e6db74;
    background: #111;
    border-radius: 4px;
    white-space: pre-wrap;
`;
