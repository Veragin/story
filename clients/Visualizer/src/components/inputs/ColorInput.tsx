import { styled, Tooltip } from '@mui/material';
import type { TInputProps } from './inputTypes';

const SWATCH_SIZE = 28;

export const ColorInput = ({
    value,
    onChange,
    hasError,
    disabled = false,
    ariaLabel,
    dataField,
}: TInputProps<string>) => (
    <Tooltip title={ariaLabel}>
        <SLabel data-disabled={disabled ? 'true' : undefined}>
            <SInput
                type="color"
                value={value}
                disabled={disabled}
                aria-label={ariaLabel}
                data-field={dataField}
                onChange={(e) => onChange(e.target.value)}
            />
            <SSwatch
                data-error={hasError ? 'true' : undefined}
                style={{ backgroundColor: value }}
            />
        </SLabel>
    </Tooltip>
);

const SLabel = styled('label')`
    position: relative;
    display: inline-flex;
    flex-shrink: 0;
    cursor: pointer;

    &[data-disabled='true'] {
        cursor: default;
        opacity: 0.4;
    }
`;

const SInput = styled('input')`
    position: absolute;
    inset: 0;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: inherit;
`;

const SSwatch = styled('span')`
    width: ${SWATCH_SIZE}px;
    height: ${SWATCH_SIZE}px;
    border-radius: 6px;
    border: 2px solid ${({ theme }) => theme.palette.common.white};

    &[data-error='true'] {
        border-color: ${({ theme }) => theme.palette.error.main};
    }
`;
