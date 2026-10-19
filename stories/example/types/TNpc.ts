import type { TWorldState } from '@story/data';
import { TLocationId } from './TLocation';
import { TItem, TItemId, TInitInventory } from './TItem';
import { TNpcId } from './ids';

export type TNpc<Ch extends TNpcId> = {
    id: Ch;
    name: string;
    description: string;
    image?: string;

    init: Omit<TWorldState['npcs'][Ch], 'inventory' | 'ref'> & TInitInventory;
};

export type TNpcData = {
    location: TLocationId | undefined;
    inventory: TItem<TItemId>[];
    isDead: boolean;
};
