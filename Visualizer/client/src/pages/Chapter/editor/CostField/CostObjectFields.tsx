import type { TLinkCostObjectDto } from '@story/visualizer-protocol';
import { FormArrayInput } from '../../../../components/inputs/form/FormArrayInput';
import type {
    TDiagnosticsOf,
    TOption,
} from '../../../../components/inputs/inputTypes';
import { TypeInput } from '../../../../components/inputs/TypeInput';
import { isString } from '../../../../components/inputs/valueSource';
import { setField } from '../PassageEditor/listUtils';
import { isCostItem } from '../costCode';
import { CostItemRow } from './CostItemRow';
import { FormDeltaTimeInput } from './FormDeltaTimeInput';

type TProps = {
    value: TLinkCostObjectDto;
    onChange: (value: TLinkCostObjectDto) => void;
    items: readonly TOption[];
    diagnosticsOf: TDiagnosticsOf;
    disabled?: boolean;
    dataField?: string;
};

export const CostObjectFields = ({
    value,
    onChange,
    items,
    diagnosticsOf,
    disabled,
    dataField = 'cost',
}: TProps) => {
    const set = <K extends keyof TLinkCostObjectDto>(
        key: K,
        next: TLinkCostObjectDto[K] | undefined
    ) => onChange(setField(value, key, next));
    const firstItem = items[0]?.id ?? '';
    return (
        <>
            <FormDeltaTimeInput
                label={_('Time (min)')}
                value={value.time}
                onChange={(time) => set('time', time)}
                optional
                diagnostics={diagnosticsOf('time')}
                disabled={disabled}
                dataField={`${dataField}.time`}
            />
            <FormArrayInput
                label={_('Items')}
                value={value.items}
                onChange={(list) => set('items', list?.filter(isCostItem))}
                optional
                newItem={() => ({ id: firstItem, amount: 1 })}
                renderItem={(item, change, index) =>
                    isCostItem(item) && (
                        <CostItemRow
                            value={item}
                            onChange={change}
                            items={items}
                            disabled={disabled}
                            ariaLabel={_('Item %d', index + 1)}
                        />
                    )
                }
                diagnostics={diagnosticsOf('items')}
                disabled={disabled}
                dataField={`${dataField}.items`}
            />
            <FormArrayInput
                label={_('Tools')}
                value={value.tools}
                onChange={(list) => set('tools', list?.filter(isString))}
                optional
                newItem={() => firstItem}
                renderItem={(tool, change, index) =>
                    isString(tool) && (
                        <TypeInput
                            value={tool}
                            onChange={change}
                            options={items}
                            disabled={disabled}
                            ariaLabel={_('Tool %d', index + 1)}
                        />
                    )
                }
                diagnostics={diagnosticsOf('tools')}
                disabled={disabled}
                dataField={`${dataField}.tools`}
            />
        </>
    );
};
