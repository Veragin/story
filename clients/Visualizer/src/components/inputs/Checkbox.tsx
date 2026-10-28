import { Checkbox as MuiCheckbox } from '@mui/material';
import { INPUT_SIZE } from './inputDefaults';
import type { TInputProps } from './inputTypes';

export const Checkbox = ({
    value,
    onChange,
    hasError,
    disabled,
    ariaLabel,
    dataField,
}: TInputProps<boolean>) => (
    <MuiCheckbox
        size={INPUT_SIZE}
        checked={value}
        color={hasError ? 'error' : 'primary'}
        disabled={disabled}
        inputProps={{ 'aria-label': ariaLabel }}
        data-field={dataField}
        onChange={(e) => onChange(e.target.checked)}
        sx={{ alignSelf: 'flex-start', p: 0.5 }}
    />
);
