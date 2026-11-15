import { useState } from 'react';
import { styled, TextField, Typography } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { spacingCss } from '@story/ui';
import {
    BUILT_IN_REF_TARGETS,
    structNameError,
    type TTypeRef,
} from '@story/protocol';
import type { TOption } from '../../../structure/option';
import { AutocompleteInput } from '../../inputs/AutocompleteInput';
import { useStructureContext } from '../../../structure/structureContext';
import { NewLiteralEditor } from './NewLiteralEditor';
import { StructureEditor } from './StructureEditor';
import {
    rowFields,
    structNameMessage,
    structureRows,
    type TLiteralDraft,
} from '../../../structure/structureRows';

type TTypeKind = TTypeRef['t'];

const KINDS: TTypeKind[] = [
    'string',
    'number',
    'boolean',
    'literal',
    'ref',
    'struct',
    'array',
    'object',
    'function',
];

const KIND_LABEL: Record<TTypeKind, () => string> = {
    string: () => _('string'),
    number: () => _('number'),
    boolean: () => _('boolean'),
    literal: () => _('literal'),
    ref: () => _('class'),
    struct: () => _('type'),
    array: () => _('array of'),
    object: () => _('object'),
    function: () => _('function'),
    code: () => _('code'),
};

const isTypeKind = (kind: string): kind is TTypeKind =>
    kind === 'code' || KINDS.some((known) => known === kind);

const isBuiltInClass = (name: string) => name in BUILT_IN_REF_TARGETS;

const TYPE_PREFIX_RE = /^T[A-Z]/;

const classRank = (name: string) =>
    !isBuiltInClass(name) ? 2 : TYPE_PREFIX_RE.test(name) ? 1 : 0;

const classOptionsOf = (names: readonly string[]): TOption[] =>
    names
        .map((id, index) => ({ id, index }))
        .sort((a, b) => classRank(a.id) - classRank(b.id) || a.index - b.index)
        .map(({ id }) => ({ id }));

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
        const visible = structure.literalsVisibleFrom(literals);
        const scopeOf = new Map(visible.map((l) => [l.name, l.scope]));
        const literalOptions: TOption[] = [
            ...visible.filter((l) => l.scope === 'global'),
            ...visible.filter((l) => l.scope === 'private'),
            ...visible.filter((l) => l.scope === 'local'),
            ...newLiterals,
        ].map((literal) => ({ id: literal.name }));
        const literalGroup = (name: string) => {
            switch (scopeOf.get(name)) {
                case 'global':
                    return _('Global');
                case 'private':
                    return _('Private');
                default:
                    return _('This file');
            }
        };
        const classOptions = classOptionsOf(structure.refTypeNames);
        const structOptions: TOption[] = structure
            .structNamesVisibleFrom(literals)
            .map((id) => ({ id }));

        const defaultOf = (kind: TTypeKind): TTypeRef => {
            switch (kind) {
                case 'string':
                case 'number':
                case 'boolean':
                    return { t: kind };
                case 'literal':
                    return { t: 'literal', name: literalOptions[0]?.id ?? '' };
                case 'ref':
                    return { t: 'ref', name: classOptions[0]?.id ?? '' };
                case 'struct':
                    return { t: 'struct', name: structOptions[0]?.id ?? '' };
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
            const error = structNameError(name, taken, 'type');
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
                    <SKindSelect
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
                    </SKindSelect>
                    {value.t === 'literal' && (
                        <AutocompleteInput
                            value={value.name}
                            onChange={(name) =>
                                onChange({ t: 'literal', name })
                            }
                            options={literalOptions}
                            groupOf={(option) => literalGroup(option.id)}
                            onCreateOption={
                                onNewLiteral ? startNewLiteral : undefined
                            }
                            createLabel={(name) =>
                                literals.owner
                                    ? _('+ New private literal %s', name)
                                    : _('+ New local literal %s', name)
                            }
                            hasError={value.name === ''}
                            disabled={disabled}
                            ariaLabel={_('%s literal', ariaLabel)}
                        />
                    )}
                    {value.t === 'ref' && (
                        <AutocompleteInput
                            value={value.name}
                            onChange={(name) => onChange({ t: 'ref', name })}
                            options={classOptions}
                            groupOf={(option) =>
                                isBuiltInClass(option.id)
                                    ? _('Built-in')
                                    : _('Story')
                            }
                            hasError={value.name === ''}
                            disabled={disabled}
                            ariaLabel={_('%s class', ariaLabel)}
                        />
                    )}
                    {value.t === 'struct' && (
                        <AutocompleteInput
                            value={value.name}
                            onChange={(name) => onChange({ t: 'struct', name })}
                            options={structOptions}
                            hasError={value.name === ''}
                            disabled={disabled}
                            ariaLabel={_('%s type name', ariaLabel)}
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
                                owner={literals.owner}
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
                        <StructureEditor
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
    border-left: 2px solid ${({ theme }) => theme.palette.border.subtle};
`;

const SCode = styled('code')`
    padding: ${spacingCss(1)};
    font-family: 'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace;
    font-size: ${({ theme }) => theme.typography.meta.fontSize};
    color: ${({ theme }) => theme.palette.text.code};
    background: ${({ theme }) => theme.palette.surface.code};
    border-radius: 4px;
    white-space: pre-wrap;
`;

const SKindSelect = styled(TextField)`
    min-width: 120px;
`;
