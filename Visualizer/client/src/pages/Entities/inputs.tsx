import { useEffect, useState } from 'react';
import {
    Autocomplete,
    Button,
    Checkbox,
    FormControlLabel,
    IconButton,
    styled,
    TextField,
    Tooltip,
} from '@mui/material';
import { Add, Delete } from '@mui/icons-material';
import { spacingCss } from '@story/ui';
import {
    isCode,
    type TInventoryEntryDto,
    type TLocalCharacterDto,
    type TMaybeCode,
    type TValue,
    type TValueRecord,
} from '@story/visualizer-protocol';
import { CodeOnlyField, MaybeCodeField, SLabel } from './CodeField';
import { isBoolean, isNumber, isString, valueToSource } from './entityFields';

const TextInput = ({
    value,
    onChange,
    multiline,
    placeholder,
    label,
}: {
    value: string;
    onChange: (v: string) => void;
    multiline?: boolean;
    placeholder?: string;
    label?: string;
}) => (
    <TextField
        size="small"
        fullWidth
        label={label}
        value={value}
        placeholder={placeholder}
        multiline={multiline}
        minRows={multiline ? 2 : undefined}
        onChange={(e) => onChange(e.target.value)}
    />
);

const NumberInput = ({
    value,
    onChange,
    label,
}: {
    value: number;
    onChange: (v: number) => void;
    label?: string;
}) => {
    const [text, setText] = useState(String(value));
    useEffect(() => {
        if (Number(text) !== value) setText(String(value));
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only an outside change resets the text
    }, [value]);
    return (
        <TextField
            size="small"
            type="number"
            label={label}
            value={text}
            onChange={(e) => {
                setText(e.target.value);
                const n = Number(e.target.value);
                if (e.target.value.trim() !== '' && Number.isFinite(n))
                    onChange(n);
            }}
            sx={{ maxWidth: 180 }}
        />
    );
};

const BoolInput = ({
    value,
    onChange,
    label,
}: {
    value: boolean;
    onChange: (v: boolean) => void;
    label: string;
}) => (
    <FormControlLabel
        control={
            <Checkbox
                checked={value}
                onChange={(e) => onChange(e.target.checked)}
            />
        }
        label={label}
    />
);

const IdPicker = ({
    value,
    onChange,
    options,
    placeholder,
    label,
}: {
    value: string;
    onChange: (v: string) => void;
    options: string[];
    placeholder?: string;
    label?: string;
}) => (
    <Autocomplete
        freeSolo
        size="small"
        options={options}
        value={value}
        onChange={(_e, v) => onChange(v ?? '')}
        onInputChange={(_e, v, reason) => {
            if (reason === 'input') onChange(v);
        }}
        renderInput={(params) => (
            <TextField {...params} label={label} placeholder={placeholder} />
        )}
        sx={{ minWidth: 200 }}
    />
);

export const IdMultiPicker = ({
    value,
    onChange,
    options,
    placeholder,
}: {
    value: string[];
    onChange: (v: string[]) => void;
    options: string[];
    placeholder?: string;
}) => (
    <Autocomplete
        multiple
        freeSolo
        size="small"
        options={options}
        value={value}
        onChange={(_e, v) => onChange(v.map(String))}
        renderInput={(params) => (
            <TextField {...params} placeholder={placeholder} />
        )}
    />
);

const isInventory = (v: unknown): v is TInventoryEntryDto[] =>
    Array.isArray(v) &&
    v.every(
        (e) =>
            typeof e === 'object' &&
            e !== null &&
            !Array.isArray(e) &&
            !isCode(e) &&
            typeof (e as { id?: unknown }).id === 'string'
    );

const InventoryField = ({
    value,
    onChange,
    itemIds,
    errors,
}: {
    value: TValue | undefined;
    onChange: (v: TValue) => void;
    itemIds: string[];
    errors?: string[];
}) => (
    <MaybeCodeField<TInventoryEntryDto[]>
        label={_('Inventory')}
        value={value as TInventoryEntryDto[] | undefined}
        onChange={(v) => onChange(v as TValue)}
        accept={isInventory}
        fallback={[]}
        errors={errors}
        block
        renderLiteral={(rows, set) => (
            <STable>
                {rows.map((row, i) => (
                    <SRow key={i}>
                        <IdPicker
                            label={_('Item')}
                            value={row.id}
                            options={itemIds}
                            onChange={(id) =>
                                set(
                                    rows.map((r, j) =>
                                        j === i ? { ...r, id } : r
                                    )
                                )
                            }
                        />
                        {typeof row.amount === 'number' ||
                        row.amount === undefined ? (
                            <NumberInput
                                label={_('Amount')}
                                value={row.amount ?? 1}
                                onChange={(amount) =>
                                    set(
                                        rows.map((r, j) =>
                                            j === i ? { ...r, amount } : r
                                        )
                                    )
                                }
                            />
                        ) : (
                            <SLabel>
                                {valueToSource(row.amount as TValue)}
                            </SLabel>
                        )}
                        <RemoveButton
                            onClick={() => set(rows.filter((_r, j) => j !== i))}
                        />
                    </SRow>
                ))}
                <AddButton
                    label={_('Add item')}
                    onClick={() =>
                        set([...rows, { id: itemIds[0] ?? '', amount: 1 }])
                    }
                />
            </STable>
        )}
    />
);

const isLocalCharacters = (v: unknown): v is TLocalCharacterDto[] =>
    Array.isArray(v) &&
    v.every(
        (e) =>
            typeof e === 'object' &&
            e !== null &&
            !Array.isArray(e) &&
            !isCode(e)
    );

export const LocalCharactersField = ({
    value,
    onChange,
    errors,
}: {
    value: unknown;
    onChange: (v: unknown) => void;
    errors?: string[];
}) => (
    <MaybeCodeField<TLocalCharacterDto[]>
        label={_('Local characters')}
        value={value as TLocalCharacterDto[]}
        onChange={onChange}
        accept={isLocalCharacters}
        fallback={[]}
        errors={errors}
        block
        renderLiteral={(rows, set) => (
            <STable>
                {rows.map((row, i) => (
                    <SRow key={i} data-top="true">
                        <SGrow>
                            <StringField
                                label={_('Name')}
                                value={row.name}
                                onChange={(name) =>
                                    set(
                                        rows.map((r, j) =>
                                            j === i
                                                ? {
                                                      ...r,
                                                      name: name as TMaybeCode<string>,
                                                  }
                                                : r
                                        )
                                    )
                                }
                            />
                        </SGrow>
                        <SGrow data-wide="true">
                            <StringField
                                label={_('Description')}
                                multiline
                                value={row.description}
                                onChange={(description) =>
                                    set(
                                        rows.map((r, j) =>
                                            j === i
                                                ? {
                                                      ...r,
                                                      description:
                                                          description as TMaybeCode<string>,
                                                  }
                                                : r
                                        )
                                    )
                                }
                            />
                        </SGrow>
                        <RemoveButton
                            onClick={() => set(rows.filter((_r, j) => j !== i))}
                        />
                    </SRow>
                ))}
                <AddButton
                    label={_('Add local character')}
                    onClick={() =>
                        set([...rows, { name: '', description: '' }])
                    }
                />
            </STable>
        )}
    />
);

export const StringField = ({
    label,
    value,
    onChange,
    multiline,
    errors,
    placeholder,
}: {
    label: string;
    value: unknown;
    onChange: (v: TValue) => void;
    multiline?: boolean;
    errors?: string[];
    placeholder?: string;
}) => (
    <MaybeCodeField<string>
        label={label}
        value={value as string | undefined}
        onChange={onChange}
        accept={isString}
        fallback=""
        errors={errors}
        renderLiteral={(v, set) => (
            <TextInput
                value={v}
                onChange={set}
                multiline={multiline}
                placeholder={placeholder}
            />
        )}
    />
);

export const IdField = ({
    label,
    value,
    onChange,
    options,
    errors,
    placeholder,
}: {
    label: string;
    value: unknown;
    onChange: (v: TValue) => void;
    options: string[];
    errors?: string[];
    placeholder?: string;
}) => (
    <MaybeCodeField<string>
        label={label}
        value={value as string | undefined}
        onChange={onChange}
        accept={isString}
        fallback=""
        errors={errors}
        renderLiteral={(v, set) => (
            <IdPicker
                value={v}
                onChange={set}
                options={options}
                placeholder={placeholder}
            />
        )}
    />
);

export type TKnownField = {
    key: string;
    label: string;
    kind: 'number' | 'string' | 'boolean' | 'location' | 'inventory';
    always?: boolean;
};

type TRecordEditorProps = {
    label: string;
    value: TValueRecord;
    onChange: (v: TValueRecord) => void;
    known: TKnownField[];
    locationIds: string[];
    itemIds: string[];
    errorsOf: (key: string) => string[];
};

export const RecordEditor = ({
    label,
    value,
    onChange,
    known,
    locationIds,
    itemIds,
    errorsOf,
}: TRecordEditorProps) => {
    const [newKey, setNewKey] = useState('');
    const knownKeys = new Set(known.map((k) => k.key));
    const set = (key: string, v: TValue) => onChange({ ...value, [key]: v });
    const remove = (key: string) => {
        const next = { ...value };
        delete next[key];
        onChange(next);
    };
    const keyError =
        newKey === ''
            ? null
            : !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(newKey)
              ? _('Not an identifier')
              : newKey in value || knownKeys.has(newKey)
                ? _('Already there')
                : null;

    return (
        <STable>
            {known
                .filter((f) => f.always || f.key in value)
                .map((f) => {
                    const v = value[f.key];
                    const errors = errorsOf(f.key);
                    switch (f.kind) {
                        case 'inventory':
                            return (
                                <InventoryField
                                    key={f.key}
                                    value={v}
                                    onChange={(x) => set(f.key, x)}
                                    itemIds={itemIds}
                                    errors={errors}
                                />
                            );
                        case 'location':
                            return (
                                <IdField
                                    key={f.key}
                                    label={f.label}
                                    value={v}
                                    options={locationIds}
                                    onChange={(x) => set(f.key, x)}
                                    errors={errors}
                                    placeholder={_('location id')}
                                />
                            );
                        case 'string':
                            return (
                                <StringField
                                    key={f.key}
                                    label={f.label}
                                    value={v}
                                    onChange={(x) => set(f.key, x)}
                                    errors={errors}
                                />
                            );
                        case 'number':
                            return (
                                <MaybeCodeField<number>
                                    key={f.key}
                                    label={f.label}
                                    value={v as number | undefined}
                                    onChange={(x) => set(f.key, x)}
                                    accept={isNumber}
                                    fallback={0}
                                    errors={errors}
                                    renderLiteral={(n, s) => (
                                        <NumberInput value={n} onChange={s} />
                                    )}
                                />
                            );
                        case 'boolean':
                            return (
                                <MaybeCodeField<boolean>
                                    key={f.key}
                                    label={f.label}
                                    value={v as boolean | undefined}
                                    onChange={(x) => set(f.key, x)}
                                    accept={isBoolean}
                                    fallback={false}
                                    errors={errors}
                                    renderLiteral={(b, s) => (
                                        <BoolInput
                                            value={b}
                                            onChange={s}
                                            label={f.label}
                                        />
                                    )}
                                />
                            );
                    }
                })}
            {Object.entries(value)
                .filter(([key]) => !knownKeys.has(key))
                .map(([key, v]) => (
                    <CodeOnlyField
                        key={key}
                        label={
                            <span>
                                {key} <SHint>{_('code')}</SHint>
                            </span>
                        }
                        value={isCode(v) ? v.code : valueToSource(v)}
                        onChange={(code) => set(key, { code })}
                        errors={errorsOf(key)}
                        actions={
                            <RemoveButton
                                onClick={() => remove(key)}
                                title={_('Remove field')}
                            />
                        }
                    />
                ))}
            <SRow>
                <TextField
                    size="small"
                    label={_('New field in %s', label)}
                    value={newKey}
                    error={!!keyError}
                    helperText={keyError ?? ' '}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && newKey && !keyError) {
                            set(newKey, { code: 'undefined' });
                            setNewKey('');
                        }
                    }}
                    onChange={(e) => setNewKey(e.target.value.trim())}
                />
                <Button
                    size="small"
                    startIcon={<Add />}
                    disabled={!newKey || !!keyError}
                    onClick={() => {
                        set(newKey, { code: 'undefined' });
                        setNewKey('');
                    }}
                    sx={{ alignSelf: 'flex-start', mt: 0.5 }}
                >
                    {_('Add field')}
                </Button>
            </SRow>
        </STable>
    );
};

const RemoveButton = ({
    onClick,
    title,
}: {
    onClick: () => void;
    title?: string;
}) => (
    <Tooltip title={title ?? _('Remove')}>
        <IconButton
            size="small"
            onClick={onClick}
            aria-label={title ?? _('Remove')}
        >
            <Delete fontSize="inherit" />
        </IconButton>
    </Tooltip>
);

const AddButton = ({
    label,
    onClick,
}: {
    label: string;
    onClick: () => void;
}) => (
    <Button
        size="small"
        startIcon={<Add />}
        onClick={onClick}
        sx={{ alignSelf: 'flex-start' }}
    >
        {label}
    </Button>
);

const STable = styled('div')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(1.5)};
    min-width: 0;
`;

export const SRow = styled('div')`
    display: flex;
    align-items: center;
    gap: ${spacingCss(1)};
    flex-wrap: wrap;
    &[data-top='true'] {
        align-items: flex-start;
    }
`;

const SGrow = styled('div')`
    flex: 1 1 180px;
    min-width: 0;
    &[data-wide='true'] {
        flex: 2 1 260px;
    }
`;

const SHint = styled('span')`
    font-weight: 400;
    text-transform: none;
    opacity: 0.6;
`;
