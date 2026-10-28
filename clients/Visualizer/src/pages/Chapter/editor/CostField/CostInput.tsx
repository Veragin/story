import { styled } from '@mui/material';
import { spacingCss } from '@story/ui';
import {
    isDeltaTime,
    type TLinkCostDto,
    type TMaybeCode,
} from '@story/protocol';
import { CodeFallback } from '../../../../components/code/CodeFallback';
import { DeltaTimeInput } from '../../../../components/inputs/DeltaTimeInput';
import type {
    TDiagnosticsOf,
    TInputProps,
} from '../../../../components/inputs/inputTypes';
import { InlineRow } from '../../../../components/layout/InlineRow';
import { SelectInput } from '../../../../components/inputs/SelectInput';
import type { TOption } from '../../../../structure/option';
import { DEFAULT_DELTA_TIME } from '../../../../values/deltaTime';
import { parseCost } from '../costCode';
import { CostObjectFields } from './CostObjectFields';

type TCostKind = 'time' | 'object';

type TProps = TInputProps<TMaybeCode<TLinkCostDto>, TLinkCostDto> & {
    items: readonly TOption[];
    diagnosticsOf: TDiagnosticsOf;
};

const kindOptions = (): TOption[] => [
    { id: 'time', label: _('Time only') },
    { id: 'object', label: _('Time, items, tools') },
];

const withKind = (cost: TLinkCostDto, kind: TCostKind): TLinkCostDto => {
    if (kind === 'object') return isDeltaTime(cost) ? { time: cost } : cost;
    if (isDeltaTime(cost)) return cost;
    return cost.time && isDeltaTime(cost.time) ? cost.time : DEFAULT_DELTA_TIME;
};

export const CostInput = ({
    value,
    items,
    diagnosticsOf,
    ...props
}: TProps) => {
    const { onChange, hasError, disabled, ariaLabel, dataField } = props;
    return (
        <CodeFallback
            {...props}
            value={value}
            parse={parseCost}
            fallback={DEFAULT_DELTA_TIME}
        >
            {(cost) => (
                <SCost data-field={dataField}>
                    <InlineRow>
                        <SKind>
                            <SelectInput
                                value={isDeltaTime(cost) ? 'time' : 'object'}
                                onChange={(kind) =>
                                    onChange(
                                        withKind(
                                            cost,
                                            kind === 'time' ? 'time' : 'object'
                                        )
                                    )
                                }
                                options={kindOptions()}
                                hasError={hasError}
                                disabled={disabled}
                                ariaLabel={_('%s kind', ariaLabel)}
                            />
                        </SKind>
                        {isDeltaTime(cost) && (
                            <DeltaTimeInput
                                value={cost}
                                onChange={onChange}
                                hasError={hasError}
                                disabled={disabled}
                                ariaLabel={_('%s minutes', ariaLabel)}
                            />
                        )}
                    </InlineRow>
                    {!isDeltaTime(cost) && (
                        <CostObjectFields
                            value={cost}
                            onChange={onChange}
                            items={items}
                            diagnosticsOf={diagnosticsOf}
                            disabled={disabled}
                            dataField={dataField}
                        />
                    )}
                </SCost>
            )}
        </CodeFallback>
    );
};

const SCost = styled('div')`
    display: flex;
    flex-direction: column;
    gap: ${spacingCss(0.75)};
`;

const SKind = styled('div')`
    max-width: 200px;
`;
