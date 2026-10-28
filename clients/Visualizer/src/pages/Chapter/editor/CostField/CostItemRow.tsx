import { styled } from '@mui/material';
import { InlineRow } from '../../../../components/layout/InlineRow';
import type { TInputProps } from '../../../../components/inputs/inputTypes';
import type { TOption } from '../../../../structure/option';
import { NumberInput } from '../../../../components/inputs/NumberInput';
import { AutocompleteInput } from '../../../../components/inputs/AutocompleteInput';
import type { TCostItem } from '../costCode';

type TProps = TInputProps<TCostItem> & {
    items: readonly TOption[];
};

export const CostItemRow = ({
    value,
    onChange,
    items,
    disabled,
    ariaLabel,
}: TProps) => (
    <InlineRow>
        <AutocompleteInput
            value={value.id}
            onChange={(id) => onChange({ ...value, id })}
            options={items}
            disabled={disabled}
            ariaLabel={_('%s item', ariaLabel)}
        />
        <SAmount>
            <NumberInput
                value={value.amount}
                onChange={(amount) => onChange({ ...value, amount })}
                disabled={disabled}
                ariaLabel={_('%s amount', ariaLabel)}
                placeholder={_('Amount')}
            />
        </SAmount>
    </InlineRow>
);

const SAmount = styled('div')`
    flex: none;
    width: 96px;
`;
