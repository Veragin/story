import { TCharacterId, TEventId, TPassageId } from './TCharacter';
import { TItemId } from './TItem';

export type TPassage<Ch extends TCharacterId, E extends TEventId> = () => {
    id: TPassageId<Ch, E>;
    eventId: E;
    title: string;
    image: string;

    data: TPassageScreen<Ch, E> | TPassageTransition<Ch, TEventId>;
};

type TPassageScreen<Ch extends TCharacterId, E extends TEventId> = {
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

type TPassageTransition<Ch extends TCharacterId, E extends TEventId> = {
    type: 'transition';
    toEventId: E;
    toPassageId: TPassageId<Ch, E>;
};
