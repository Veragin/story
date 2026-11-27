import { styled, Tab, Tabs } from '@mui/material';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { Column, spacingCss } from '@story/ui';
import { useEngine, useWorldState } from '../../../context';
import { countByType, itemType, itemTypes, sortItems, typeLabel } from './inventoryItems';
import { ItemCard } from './ItemCard';
import { ItemTypeIcon } from './ItemTypeIcon';

type TTypeFilter = string | undefined | null;

const ALL_TYPES = null;

export const Inventory = observer(() => {
    const e = useEngine();
    const s = useWorldState();
    const [selected, setSelected] = useState<TTypeFilter>(ALL_TYPES);

    const items = sortItems(e.inventory.getInventory(s.mainCharacterId));
    const filters: TTypeFilter[] = [ALL_TYPES, ...itemTypes(Object.values(e.storyModule.itemInfo), items)];
    const selectedIndex = Math.max(filters.indexOf(selected), 0);
    const activeFilter = filters[selectedIndex];
    const visibleItems =
        activeFilter === ALL_TYPES ? items : items.filter((item) => itemType(item) === activeFilter);

    return (
        <SContainer>
            <STabs
                value={selectedIndex}
                onChange={(_event, index: number) => setSelected(filters[index])}
                variant="scrollable"
                scrollButtons="auto"
            >
                {filters.map((filter) =>
                    filter === ALL_TYPES ? (
                        <Tab key="all" label={`${_('All')} (${items.length})`} data-tab="all" />
                    ) : (
                        <Tab
                            key={filter ?? ''}
                            icon={<ItemTypeIcon type={filter} />}
                            iconPosition="start"
                            label={`${typeLabel(filter)} (${countByType(items, filter)})`}
                            data-tab={filter ?? ''}
                        />
                    )
                )}
            </STabs>
            {visibleItems.length === 0 ? (
                <SEmpty>
                    {activeFilter === ALL_TYPES ? _('Your inventory is empty.') : _('No items of this type.')}
                </SEmpty>
            ) : (
                <SGrid>
                    {visibleItems.map((item) => (
                        <ItemCard key={item.id} item={item} />
                    ))}
                </SGrid>
            )}
        </SContainer>
    );
});

const SContainer = styled(Column)`
    gap: ${spacingCss(2)};
`;

const STabs = styled(Tabs)`
    position: sticky;
    top: -${spacingCss(2)};
    z-index: 1;
    flex-shrink: 0;
    min-height: 0;
    margin: -${spacingCss(2)} -${spacingCss(2)} 0;
    padding: 0 ${spacingCss(1)};
    background-color: #2a2a2a;
    border-bottom: 1px solid rgba(255, 255, 255, 0.15);

    .MuiTab-root {
        min-height: 48px;
        color: rgba(255, 255, 255, 0.6);
    }

    .MuiTab-root.Mui-selected {
        color: #ffc300;
    }

    .MuiTabs-indicator {
        background-color: #ffc300;
    }
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
