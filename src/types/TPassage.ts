import { TCharacterId, TEventCharacterPassageId, TEventId } from './TIds';
import { TItemId } from './TItem';

export type TEventPassage<E extends TEventId> = TPassage<E, TCharacterId>;

export type TPassage<E extends TEventId, Ch extends TCharacterId> =
    | TPassageScreen<E, Ch>
    | TPassageTransition<E, Ch>;

export type TPassageScreen<E extends TEventId, Ch extends TCharacterId> = {
    eventId: E;
    characterId: Ch;
    id: string;

    title: string;
    image: string;
    type: 'screen';
    body: {
        condition: boolean;
        text: string;
        links: {
            text: string;
            passageId: TEventCharacterPassageId<E, Ch>;
            autoPriortiy: number;
            cost: TLinkCost;

            callback?: () => void;
        }[];
    }[];
};

export type TLinkCost =
    | DeltaTime
    | {
          time?: DeltaTime;
          items?: { id: TItemId; count: number }[];
          tools?: TItemId[];
      };

export type TPassageTransition<E extends TEventId, Ch extends TCharacterId> = {
    eventId: E;
    characterId: Ch;
    id: string;
    type: 'transition';
    toPassageId: TEventCharacterPassageId<TEventId, Ch>;
};
