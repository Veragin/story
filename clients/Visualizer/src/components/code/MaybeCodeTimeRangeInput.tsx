import { Box, Stack } from '@mui/material';
import { isCode, type TMaybeCode, type TTimeRangeDto } from '@story/protocol';
import type { TInputProps } from '../inputs/inputTypes';
import { TimeRangeInput } from '../inputs/TimeRangeInput';
import {
    TIME_RANGE_ENDS,
    type TTimeRange,
    type TTimeRangeEnd,
} from '../inputs/timeRange';
import { CodeTextArea } from './CodeTextArea';
import { MaybeCodeTimeInput } from './MaybeCodeTimeInput';

type TProps = TInputProps<TMaybeCode<TTimeRangeDto>> & {
    endHasError?: (end: TTimeRangeEnd) => boolean;
};

const plainRange = ({ start, end }: TTimeRangeDto): TTimeRange | undefined =>
    isCode(start) || isCode(end) ? undefined : { start, end };

export const MaybeCodeTimeRangeInput = ({
    value,
    onChange,
    endHasError = () => false,
    ...props
}: TProps) => {
    if (isCode(value)) {
        return (
            <CodeTextArea
                {...props}
                value={value.code}
                onChange={(code) => onChange({ code })}
            />
        );
    }
    const plain = plainRange(value);
    if (plain) {
        return (
            <TimeRangeInput
                {...props}
                value={plain}
                onChange={onChange}
                endHasError={endHasError}
            />
        );
    }
    return (
        <Stack direction="row" gap={1.5} alignItems="flex-start">
            {TIME_RANGE_ENDS.map(({ key, label }) => (
                <Box key={key} flex={1} minWidth={0}>
                    <MaybeCodeTimeInput
                        value={value[key]}
                        onChange={(next) => onChange({ ...value, [key]: next })}
                        hasError={props.hasError || endHasError(key)}
                        disabled={props.disabled}
                        ariaLabel={label()}
                        dataField={
                            props.dataField && `${props.dataField}.${key}`
                        }
                    />
                </Box>
            ))}
        </Stack>
    );
};
