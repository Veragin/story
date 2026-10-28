import type { TDeltaTimeDto } from '@story/protocol';
import type { TInputProps } from './inputTypes';
import { NumberInput } from './NumberInput';

export const DeltaTimeInput = ({
    value,
    onChange,
    ...props
}: TInputProps<TDeltaTimeDto>) => (
    <NumberInput
        {...props}
        value={value.seconds / 60}
        onChange={(minutes) => onChange({ seconds: Math.round(minutes * 60) })}
        placeholder={_('Minutes')}
    />
);
