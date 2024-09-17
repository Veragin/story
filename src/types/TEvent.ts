import { TCharacterId, TEventId } from './TCharacter';
import { TPassage } from './TPassage';

export type TEvent<Ch extends TCharacterId> = {
    eventId: TEventId<Ch>;
    title: string;
    description: string;

    timeRange: {
        start: number;
        end: number;
    };
    location: string;

    passages: Record<TEventId<Ch>, TPassage<Ch, TEventId<Ch>>>;
    startPassageId: string;

    children: {
        condition: string;
        event: TEvent<Ch>;
    }[];
};
