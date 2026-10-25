import { styled } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { Column, spacingCss } from '@story/ui';
import { useEngine, useWorldState } from '../../../context';
import { groupItemsByType, typeLabel } from './inventoryItems';
import { ItemCard } from './ItemCard';

export const Inventory = observer(() => {
    const e = useEngine();
    const s = useWorldState();
    const groups = groupItemsByType(e.inventory.getInventory(s.mainCharacterId));

    if (groups.length === 0) {
        return <SEmpty>{_('Your inventory is empty.')}</SEmpty>;
    }

    return (
        <SContainer>
            {groups.map((group) => (
                <SGroup key={group.type ?? ''}>
                    <SGroupTitle>{typeLabel(group.type)}</SGroupTitle>
                    <SGrid>
                        {group.items.map((item) => (
                            <ItemCard key={item.id} item={item} />
                        ))}
                    </SGrid>
                </SGroup>
            ))}
        </SContainer>
    );
});

const SContainer = styled(Column)`
    gap: ${spacingCss(2.5)};
`;

const SGroup = styled(Column)`
    gap: ${spacingCss(1)};
`;

const SGroupTitle = styled('h3')`
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.6);
`;

const SGrid = styled('div')`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr));
    gap: ${spacingCss(1)};
`;

const SEmpty = styled('p')`
    margin: ${spacingCss(4)} 0;
    text-align: center;
    font-size: 18px;
    color: rgba(255, 255, 255, 0.6);
`;
