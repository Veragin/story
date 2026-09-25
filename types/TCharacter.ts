import type { TWorldState } from '@story/data';
import { TLocationId } from './TLocation';
import { TItem, TItemId, TItemPartial } from './TItem';
import { TCharacterId, TCharacterPassageId, TNpcId } from './ids';

export type TCharacter<Ch extends TCharacterId> = {
    id: Ch;
    name: string;
    description?: string;

    startPassageId?: TCharacterPassageId<Ch>;
    init: Omit<TWorldState['characters'][Ch], 'inventory' | 'ref'> & TInitInventory;
};

export type TCharacterData = {
    location?: TLocationId;
    health: number;
    stamina: number;
    hunger: number;
    inventory: TItem<TItemId>[];
};

export type TNpc<Ch extends TNpcId> = {
    id: Ch;
    name: string;
    description: string;

    init: Omit<TWorldState['npcs'][Ch], 'inventory' | 'ref'> & TInitInventory;
};

export type TNpcData = {
    location: TLocationId | undefined;
    inventory: TItem<TItemId>[];
    isDead: boolean;
};

type TInitInventory = { inventory: TItemPartial<TItemId>[] };
