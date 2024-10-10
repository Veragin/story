import { TCharacterId, TEventCharacterPassageId, TEventId, TEventPassageId } from './TIds';
import { TItemId } from './TItem';

export type TEventPassage<E extends TEventId> = TPassage<E, TCharacterId, TEventPassageId<E>>;

export type TPassage<E extends TEventId, Ch extends TCharacterId, Ids extends TEventPassageId<E>> =
    | TPassageScreen<E, Ch, Ids>
    | TPassageTransition<E, Ch>;

export type TPassageScreen<E extends TEventId, Ch extends TCharacterId, Ids extends TEventPassageId<E>> = {
    eventId: E;
    characterId: Ch;
    id: string;

    title: string;
    image: string;
    type: 'screen';
    body: {
        condition?: boolean;
        redirect?: Ids & TEventCharacterPassageId<E, Ch>;
        text?: string;
        links?: TLink<Ids & TEventCharacterPassageId<E, Ch>>[];
    }[];
};

export type TLink<Ids extends TEventCharacterPassageId<TEventId, TCharacterId>> = {
    text: string;
    passageId: Ids;
    autoPriortiy?: number;
    cost?: TLinkCost;

    onFinish?: () => void;
};

export type TLinkCost =
    | DeltaTime
    | {
          time?: DeltaTime;
          items?: { id: TItemId; amount: number }[];
          tools?: TItemId[];
      };

export type TPassageTransition<E extends TEventId, Ch extends TCharacterId> = {
    eventId: E;
    characterId: Ch;
    id: string;
    type: 'transition';
    nextPassageId: TEventCharacterPassageId<TEventId, Ch>;
};

export type TPassageLinearDescriber<E extends TEventId, Ch extends TCharacterId, Ids extends TEventPassageId<E>> = {
    eventId: E;
    characterId: Ch;
    id: string;
    type: 'linear';
    description: string;
    nextPassageId?: Ids & TEventCharacterPassageId<E, Ch>;
};
