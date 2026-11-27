import { styled } from '@mui/material';
import { spacingCss } from '@story/ui';
import type { TInputProps } from './inputTypes';
import { TimeInput } from './TimeInput';
import {
    TIME_RANGE_ENDS,
    type TTimeRange,
    type TTimeRangeEnd,
} from './timeRange';

type TProps = TInputProps<TTimeRange> & {
    endHasError?: (end: TTimeRangeEnd) => boolean;
};

export const TimeRangeInput = ({
    value,
    onChange,
    endHasError = () => false,
    hasError,
    disabled,
    dataField,
}: TProps) => (
    <STimeRange>
        {TIME_RANGE_ENDS.map(({ key, label }) => (
            <SEnd key={key}>
                <TimeInput
                    value={value[key]}
                    onChange={(next) => onChange({ ...value, [key]: next })}
                    hasError={hasError || endHasError(key)}
                    disabled={disabled}
                    ariaLabel={label()}
                    dataField={dataField && `${dataField}.${key}`}
                />
            </SEnd>
        ))}
    </STimeRange>
);

const STimeRange = styled('div')`
    display: flex;
    gap: ${spacingCss(1.5)};
    align-items: flex-start;
`;

const SEnd = styled('div')`
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
`;
