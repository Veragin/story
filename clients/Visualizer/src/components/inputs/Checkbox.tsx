import { Checkbox as MuiCheckbox, styled } from '@mui/material';
import { spacingCss } from '@story/ui';
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
    <SCheckbox
        size={INPUT_SIZE}
        checked={value}
        color={hasError ? 'error' : 'primary'}
        disabled={disabled}
        inputProps={{ 'aria-label': ariaLabel }}
        data-field={dataField}
        onChange={(e) => onChange(e.target.checked)}
    />
);

const SCheckbox = styled(MuiCheckbox)`
    align-self: flex-start;
    padding: ${spacingCss(0.5)};
`;
