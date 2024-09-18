import { TCharacterId, TEventId, TPassageId } from './TCharacter';
import { TItemId } from './TItem';

export type TPassage<Ch extends TCharacterId, E extends TEventId> = () =>
    | TPassageScreen<Ch, E>
    | TPassageTransition<Ch, E>;

export type TPassageScreen<Ch extends TCharacterId, E extends TEventId> = {
    id: TPassageId<Ch, E>;
    eventId: E;
    title: string;
    image: string;
    type: 'screen';
    body: {
        condition: boolean;
        text: string;
        links: {
            passageId: TPassageId<Ch, E>;
            cost:
                | number
                | {
                      time?: number;
                      items?: { id: TItemId; count: number }[];
                      tools?: TItemId[];
                  }[];
            callback?: () => void;
        }[];
    }[];
};

export type TPassageTransition<Ch extends TCharacterId, E extends TEventId> = {
    id: TPassageId<Ch, E>;
    eventId: E;
    type: 'transition';
    toEventId: E;
    toPassageId: TPassageId<Ch, E>;
};
