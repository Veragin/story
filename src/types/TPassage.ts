import { DeltaTime } from 'code/time/Time';
import { TCharacterIdInEvent, TEventId, TPassageId } from './TCharacter';
import { TItemId } from './TItem';

export type TPassage<E extends TEventId, Ch extends TCharacterIdInEvent<E>> = () =>
    | TPassageScreen<E, Ch>
    | TPassageTransition<E, Ch>;

export type TPassageScreen<E extends TEventId, Ch extends TCharacterIdInEvent<E>> = {
    id: TPassageId<E, Ch>;
    eventId: E;
    characterId: Ch;
    title: string;
    image: string;
    type: 'screen';
    body: {
        condition: boolean;
        text: string;
        links: {
            text: string;
            passageId: TPassageId<E, Ch>;
            cost: TPassageCost;

            callback?: () => void;
        }[];
    }[];
};

export type TPassageCost =
    | DeltaTime
    | {
          time?: DeltaTime;
          items?: { id: TItemId; count: number }[];
          tools?: TItemId[];
      }[];

export type TPassageTransition<E extends TEventId, Ch extends TCharacterIdInEvent<E>> = {
    id: TPassageId<E, Ch>;
    eventId: E;
    type: 'transition';
    toEventId: E;
    toPassageId: TPassageId<E, Ch>;
};
