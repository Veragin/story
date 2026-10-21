import { Chip, styled } from '@mui/material';
import { Column, Row, spacingCss } from '@story/ui';
import { itemDetails, itemType, type TInventoryItem } from './inventoryItems';
import { ItemTypeIcon } from './ItemTypeIcon';

type Props = {
    item: TInventoryItem;
};

export const ItemCard = ({ item }: Props) => {
    const details = itemDetails(item);

    return (
        <SCard>
            <SIcon>
                <ItemTypeIcon type={itemType(item)} />
            </SIcon>
            <SBody>
                <SName>{item.name}</SName>
                {details.length > 0 && (
                    <SChips>
                        {details.map((d) => (
                            <Chip
                                key={d.key}
                                label={d.label}
                                size="small"
                                variant="outlined"
                            />
                        ))}
                    </SChips>
                )}
            </SBody>
            <SAmount aria-label={_('Amount')}>×{item.amount}</SAmount>
        </SCard>
    );
};

const SCard = styled(Row)`
    align-items: center;
    gap: ${spacingCss(1.5)};
    padding: ${spacingCss(1.5)};
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background-color: #001d3d;
`;

const SIcon = styled('div')`
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border-radius: 8px;
    background-color: #003566;
    color: #ffc300;
    font-size: 26px;
`;

const SBody = styled(Column)`
    flex: 1;
    min-width: 0;
    gap: ${spacingCss(0.75)};
`;

const SName = styled('span')`
    font-size: 18px;
    font-weight: 500;
    overflow-wrap: anywhere;
`;

const SChips = styled(Row)`
    flex-wrap: wrap;
    gap: ${spacingCss(0.5)};
`;

const SAmount = styled('span')`
    flex-shrink: 0;
    min-width: 40px;
    padding: ${spacingCss(0.5)} ${spacingCss(1)};
    border-radius: 999px;
    background-color: #ffc300;
    color: #000;
    font-weight: 600;
    text-align: center;
`;
