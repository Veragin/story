import { Slider, styled } from '@mui/material';
import { spacingCss } from '@story/ui';
import { INPUT_SIZE } from './inputDefaults';
import type { TInputProps } from './inputTypes';

type TProps = TInputProps<number> & {
    min: number;
    max: number;
    step?: number;
};

export const SliderInput = ({
    value,
    onChange,
    min,
    max,
    step = 1,
    hasError,
    disabled,
    ariaLabel,
    dataField,
}: TProps) => (
    <SSlider
        size={INPUT_SIZE}
        min={min}
        max={max}
        step={step}
        value={value}
        color={hasError ? 'error' : 'primary'}
        disabled={disabled}
        aria-label={ariaLabel}
        data-field={dataField}
        onChange={(_e, next) => onChange(Array.isArray(next) ? next[0] : next)}
    />
);

const SSlider = styled(Slider)`
    margin: 0 ${spacingCss(1)};
`;
