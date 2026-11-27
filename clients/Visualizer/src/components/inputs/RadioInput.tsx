import { FormControlLabel, Radio, RadioGroup } from '@mui/material';
import type { TOption } from '../../structure/option';
import { INPUT_SIZE } from './inputDefaults';
import type { TInputProps } from './inputTypes';

type TProps = TInputProps<string> & {
    options: readonly TOption[];
    row?: boolean;
};

export const RadioInput = ({
    value,
    onChange,
    options,
    row,
    hasError,
    disabled,
    ariaLabel,
    dataField,
}: TProps) => (
    <RadioGroup
        row={row}
        value={value}
        aria-label={ariaLabel}
        data-field={dataField}
        onChange={(e) => onChange(e.target.value)}
    >
        {options.map((option) => (
            <FormControlLabel
                key={option.id}
                value={option.id}
                disabled={disabled}
                control={
                    <Radio
                        size={INPUT_SIZE}
                        color={hasError ? 'error' : 'primary'}
                    />
                }
                label={option.label ?? option.id}
                data-option={option.id}
            />
        ))}
    </RadioGroup>
);
