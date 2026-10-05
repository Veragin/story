import { MenuItem, styled, TextField } from '@mui/material';
import { spacingCss } from '@story/ui';
import {
    isCode,
    isDeltaTime,
    type TLinkCostDto,
    type TMaybeCode,
} from '@story/visualizer-protocol';
import { CodeValue } from '../../../../components/inputs/CodeValue';
import type {
    TDiagnosticsOf,
    TInputProps,
    TOption,
} from '../../../../components/inputs/inputTypes';
import { DEFAULT_COST_TIME, parseCost } from '../costCode';
import { CostObjectFields } from './CostObjectFields';
import { DeltaTimeInput } from './DeltaTimeInput';

type TCostKind = 'time' | 'object';

type TProps = TInputProps<TMaybeCode<TLinkCostDto>, TLinkCostDto> & {
    items: readonly TOption[];
    diagnosticsOf: TDiagnosticsOf;
};

const withKind = (cost: TLinkCostDto, kind: TCostKind): TLinkCostDto => {
    if (kind === 'object') return isDeltaTime(cost) ? { time: cost } : cost;
    if (isDeltaTime(cost)) return cost;
    return cost.time && isDeltaTime(cost.time) ? cost.time : DEFAULT_COST_TIME;
};

export const CostInput = ({
    value,
    onChange,
    items,
    diagnosticsOf,
    hasError,
    disabled,
    ariaLabel,
    dataField,
}: TProps) => {
    if (isCode(value)) {
        return (
            <CodeValue
                code={value.code}
                parse={parseCost}
                fallback={DEFAULT_COST_TIME}
                onChange={onChange}
                hasError={hasError}
                disabled={disabled}
                ariaLabel={ariaLabel}
            />
        );
    }
    const simple = isDeltaTime(value);
    return (
        <SCost data-field={dataField}>
            <SRow>
                <TextField
                    select
                    size="small"
                    value={simple ? 'time' : 'object'}
                    error={hasError}
                    disabled={disabled}
                    sx={{ width: 200 }}
                    slotProps={{
                        htmlInput: { 'aria-label': _('%s kind', ariaLabel) },
                    }}
                    onChange={(e) =>
                        onChange(
                            withKind(
                                value,
                                e.target.value === 'time' ? 'time' : 'object'
                            )
                        )
                    }
                >
                    <MenuItem value="time">{_('Time only')}</MenuItem>
                    <MenuItem value="object">
                        {_('Time, items, tools')}
                    </MenuItem>
                </TextField>
                {simple && (
                    <DeltaTimeInput
                        value={value}
                        onChange={onChange}
                        hasError={hasError}
                        disabled={disabled}
                        ariaLabel={_('%s minutes', ariaLabel)}
                    />
                )}
            </SRow>
            {!simple && (
                <CostObjectFields
                    value={value}
                    onChange={onChange}
                    items={items}
                    diagnosticsOf={diagnosticsOf}
                    disabled={disabled}
                    dataField={dataField}
                />
            )}
        </SCost>
    );
};

const SCost = styled('div')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(0.75)};
`;

const SRow = styled('div')`
    display: flex;
    gap: ${spacingCss(1)};
    align-items: flex-start;
`;
