import { useState, type HTMLAttributes, type Key } from 'react';
import { Autocomplete, createFilterOptions, TextField } from '@mui/material';
import type { TOption } from '../../structure/option';
import { INPUT_DEFAULTS } from './inputDefaults';
import { inputSlotProps } from './inputSlotProps';
import type { TInputProps } from './inputTypes';

type TProps = TInputProps<string> & {
    options: readonly TOption[];
    freeSolo?: boolean;
    onCreateOption?: (value: string) => Promise<boolean>;
    createLabel?: (value: string) => string;
    groupOf?: (option: TOption) => string;
    placeholder?: string;
};

type TLiProps = HTMLAttributes<HTMLLIElement> & { key?: Key };

// MUI passes `key` inside the props; React rejects a spread key
const withoutKey = (liProps: TLiProps) => {
    const props = { ...liProps };
    delete props.key;
    return props;
};

// options are ids, stable by value so MUI keeps the typed text; a create row is marked by the prefix
const CREATE = '\u0000create:';

const isCreate = (option: string) => option.startsWith(CREATE);

const created = (option: string) => option.slice(CREATE.length);

export const AutocompleteInput = ({
    value,
    onChange,
    options,
    freeSolo,
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
    const outside = !freeSolo && !known && value !== '';

    const textOf = (id: string) => byId.get(id)?.label || id;
    const filter = createFilterOptions<string>({
        stringify: (id) => `${id} ${byId.get(id)?.label ?? ''}`,
    });
    const groupBy = groupOf
        ? (id: string) => {
              const option = byId.get(id);
              return option ? groupOf(option) : '';
          }
        : undefined;
    const renderOptionText = (liProps: TLiProps, id: string) => (
        <li {...withoutKey(liProps)} key={id} data-option={id}>
            {textOf(id)}
        </li>
    );

    const create = async (input: string) => {
        if (!onCreateOption) return;
        setCreating(true);
        try {
            if (await onCreateOption(input)) onChange(input);
        } finally {
            setCreating(false);
        }
    };

    if (freeSolo) {
        return (
            <Autocomplete<string, false, false, true>
                {...INPUT_DEFAULTS}
                freeSolo
                options={ids}
                inputValue={value}
                disabled={disabled}
                groupBy={groupBy}
                getOptionLabel={textOf}
                filterOptions={filter}
                renderOption={renderOptionText}
                onInputChange={(_e, next) => onChange(next)}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        error={hasError}
                        placeholder={placeholder}
                        slotProps={inputSlotProps(
                            { ariaLabel, dataField },
                            params.inputProps
                        )}
                    />
                )}
            />
        );
    }

    return (
        <Autocomplete<string, false, true, false>
            {...INPUT_DEFAULTS}
            disableClearable
            options={all}
            value={value}
            disabled={disabled || creating}
            groupBy={groupBy}
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
            renderOption={(liProps: TLiProps, id) =>
                isCreate(id) ? (
                    <li
                        {...withoutKey(liProps)}
                        key={id}
                        data-create={created(id)}
                    >
                        {createLabel(created(id))}
                    </li>
                ) : (
                    renderOptionText(liProps, id)
                )
            }
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
                    slotProps={inputSlotProps(
                        { ariaLabel, dataField },
                        params.inputProps
                    )}
                />
            )}
        />
    );
};
