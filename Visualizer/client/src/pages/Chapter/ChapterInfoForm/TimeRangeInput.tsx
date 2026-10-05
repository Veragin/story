import { styled } from '@mui/material';
import { spacingCss } from '@story/ui';
import {
    isCode,
    type TMaybeCode,
    type TTimeRangeDto,
} from '@story/visualizer-protocol';
import { CodeTextArea } from '../../../components/inputs/CodeTextArea';
import { FormLabel } from '../../../components/inputs/form/FormLabel';
import { InputDiagnostics } from '../../../components/inputs/InputDiagnostics';
import type { TDiagnosticsOf } from '../../../components/inputs/inputTypes';
import { TimeInput } from './TimeInput';

type TProps = {
    value: TMaybeCode<TTimeRangeDto>;
    onChange: (value: TMaybeCode<TTimeRangeDto>) => void;
    diagnostics: TDiagnosticsOf;
    disabled?: boolean;
};

const ENDS = [
    { key: 'start', label: () => _('Start') },
    { key: 'end', label: () => _('End') },
] as const;

export const TimeRangeInput = ({
    value,
    onChange,
    diagnostics,
    disabled,
}: TProps) => {
    const own = diagnostics('timeRange');
    if (isCode(value)) {
        return (
            <FormLabel label={_('Time range (code)')} diagnostics={own}>
                <CodeTextArea
                    value={value.code}
                    onChange={(code) => onChange({ code })}
                    hasError={own.length > 0}
                    disabled={disabled}
                    ariaLabel={_('Time range')}
                    dataField="timeRange"
                />
            </FormLabel>
        );
    }
    return (
        <FormLabel
            label={_('Time range')}
            helperText={_('day.month. hour:minute')}
            diagnostics={own}
        >
            <SRow>
                {ENDS.map(({ key, label }) => {
                    const ends = diagnostics(`timeRange.${key}`);
                    return (
                        <SEnd key={key}>
                            <TimeInput
                                value={value[key]}
                                onChange={(next) =>
                                    onChange({ ...value, [key]: next })
                                }
                                hasError={ends.length > 0}
                                disabled={disabled}
                                ariaLabel={label()}
                                dataField={`timeRange.${key}`}
                            />
                            <InputDiagnostics diagnostics={ends} />
                        </SEnd>
                    );
                })}
            </SRow>
        </FormLabel>
    );
};

const SRow = styled('div')`
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
