import { styled } from '@mui/material';
import { spacingCss } from '@story/ui';
import type {
    TInputProps,
    TOption,
} from '../../../../components/inputs/inputTypes';
import { NumberInput } from '../../../../components/inputs/NumberInput';
import { TypeInput } from '../../../../components/inputs/TypeInput';
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
    <SRow>
        <SItem>
            <TypeInput
                value={value.id}
                onChange={(id) => onChange({ ...value, id })}
                options={items}
                disabled={disabled}
                ariaLabel={_('%s item', ariaLabel)}
            />
        </SItem>
        <SAmount>
            <NumberInput
                value={value.amount}
                onChange={(amount) => onChange({ ...value, amount })}
                disabled={disabled}
                ariaLabel={_('%s amount', ariaLabel)}
                placeholder={_('Amount')}
            />
        </SAmount>
    </SRow>
);

const SRow = styled('div')`
    display: flex;
    gap: ${spacingCss(1)};
    align-items: flex-start;
`;

const SItem = styled('div')`
    flex: 1;
    min-width: 0;
`;

const SAmount = styled('div')`
    flex: none;
    width: 96px;

    & .MuiTextField-root {
        width: 100%;
    }
`;
