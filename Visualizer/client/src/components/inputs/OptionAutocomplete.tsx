import { useState, type HTMLAttributes, type Key } from 'react';
import { Autocomplete, createFilterOptions, TextField } from '@mui/material';
import type { TInputProps, TOption } from './inputTypes';

type TProps = TInputProps<string> & {
    options: readonly TOption[];
    onCreateOption?: (value: string) => Promise<boolean>;
    createLabel?: (value: string) => string;
    groupOf?: (option: TOption) => string;
    placeholder?: string;
};

// options are ids, stable by value so MUI keeps the typed text; a create row is marked by the prefix
const CREATE = '\u0000create:';

const isCreate = (option: string) => option.startsWith(CREATE);

const created = (option: string) => option.slice(CREATE.length);

export const OptionAutocomplete = ({
    value,
    onChange,
    options,
    onCreateOption,
    createLabel = (input) => _('+ Add %s', input),
    groupOf,
    placeholder,
    hasError,
    disabled,
    ariaLabel,
    dataField,
}: TProps) => {
    const [creating, setCreating] = useState(false);
    const byId = new Map(options.map((option) => [option.id, option]));
    const known = byId.has(value);
    const ids = options.map((option) => option.id);
    // the current value is listed even when unknown, so MUI can show it; it is not pickable
    const all = known ? ids : [...ids, value];
    const outside = !known && value !== '';

    const textOf = (id: string) => {
        const label = byId.get(id)?.label;
        return label && label !== id ? `${id} — ${label}` : id;
    };
    const filter = createFilterOptions<string>({
        stringify: (id) => `${id} ${byId.get(id)?.label ?? ''}`,
    });

    const create = async (input: string) => {
        if (!onCreateOption) return;
        setCreating(true);
        try {
            if (await onCreateOption(input)) onChange(input);
        } finally {
            setCreating(false);
        }
    };

    return (
        <Autocomplete<string, false, true, false>
            size="small"
            fullWidth
            disableClearable
            options={all}
            value={value}
            disabled={disabled || creating}
            groupBy={
                groupOf
                    ? (id) => {
                          const option = byId.get(id);
                          return option ? groupOf(option) : '';
                      }
                    : undefined
            }
            getOptionLabel={(id) => (isCreate(id) ? created(id) : textOf(id))}
            getOptionDisabled={(id) => !isCreate(id) && !byId.has(id)}
            filterOptions={(list, state) => {
                const shown = filter(
                    list.filter((id) => byId.has(id)),
                    state
                );
                const input = state.inputValue.trim();
                if (onCreateOption && input !== '' && !byId.has(input))
                    shown.push(`${CREATE}${input}`);
                return shown;
            }}
            renderOption={(
                liProps: HTMLAttributes<HTMLLIElement> & { key?: Key },
                id
            ) => {
                // MUI passes `key` inside the props; React rejects a spread key
                const props = { ...liProps };
                delete props.key;
                return isCreate(id) ? (
                    <li {...props} key={id} data-create={created(id)}>
                        {createLabel(created(id))}
                    </li>
                ) : (
                    <li {...props} key={id} data-option={id}>
                        {textOf(id)}
                    </li>
                );
            }}
            onChange={(_e, next) => {
                if (isCreate(next)) void create(created(next));
                else onChange(next);
            }}
            renderInput={(params) => (
                <TextField
                    {...params}
                    error={hasError || outside}
                    placeholder={placeholder}
                    helperText={
                        outside ? _('Not one of the options') : undefined
                    }
                    slotProps={{
                        htmlInput: {
                            ...params.inputProps,
                            'aria-label': ariaLabel,
                            'data-field': dataField,
                        },
                    }}
                />
            )}
        />
    );
};
