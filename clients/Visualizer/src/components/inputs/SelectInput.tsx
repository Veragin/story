import { MenuItem, TextField } from '@mui/material';
import type { TOption } from '../../structure/option';
import { INPUT_DEFAULTS } from './inputDefaults';
import { inputSlotProps } from './inputSlotProps';
import type { TInputProps } from './inputTypes';

type TProps = TInputProps<string> & {
    options: readonly TOption[];
};

export const SelectInput = ({
    value,
    onChange,
    options,
    hasError,
    disabled,
    ariaLabel,
    dataField,
}: TProps) => (
    <TextField
        {...INPUT_DEFAULTS}
        select
        value={value}
        error={hasError}
        disabled={disabled}
        slotProps={inputSlotProps({ ariaLabel, dataField })}
        onChange={(e) => onChange(e.target.value)}
    >
        {options.map((option) => (
            <MenuItem key={option.id} value={option.id} data-option={option.id}>
                {option.label ?? option.id}
            </MenuItem>
        ))}
    </TextField>
);
