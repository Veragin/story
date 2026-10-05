import {
    isCode,
    type TDeltaTimeDto,
    type TMaybeCode,
} from '@story/visualizer-protocol';
import { CodeValue } from '../../../../components/inputs/CodeValue';
import type { TInputProps } from '../../../../components/inputs/inputTypes';
import { NumberInput } from '../../../../components/inputs/NumberInput';
import { DEFAULT_COST_TIME, parseDelta } from '../costCode';

type TProps = TInputProps<TMaybeCode<TDeltaTimeDto>, TDeltaTimeDto>;

export const DeltaTimeInput = ({ value, onChange, ...props }: TProps) =>
    isCode(value) ? (
        <CodeValue
            code={value.code}
            parse={parseDelta}
            fallback={DEFAULT_COST_TIME}
            onChange={onChange}
            hasError={props.hasError}
            disabled={props.disabled}
            ariaLabel={props.ariaLabel}
        />
    ) : (
        <NumberInput
            {...props}
            value={value.seconds / 60}
            onChange={(minutes) =>
                onChange({ seconds: Math.round(minutes * 60) })
            }
            placeholder={_('Minutes')}
        />
    );
