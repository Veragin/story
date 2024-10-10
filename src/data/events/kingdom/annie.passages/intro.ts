import { DeltaTime } from 'time/Time';
import { TPassage } from 'types/TPassage';
import { TKingdomPassageId } from '../kingdom.event';
import { TWorldState } from 'data/TWorldState';

export const introPassage = (s: TWorldState): TPassage<'kingdom', 'annie', TKingdomPassageId> => ({
    eventId: 'kingdom',
    characterId: 'annie',
    id: 'intro',

    type: 'screen',
    title: 'title',
    image: 'image',

    body: [
        {
            condition: s.characters.annie.health > 0,
            text: 'text',
            links: [
                {
                    text: 'Lets go to the forest',
                    passageId: 'kingdom-annie-palace',
                    cost: {
                        time: DeltaTime.fromMin(10),
                        items: [{ id: 'berries', amount: 1 }],
                    },
                    autoPriortiy: 1,
                },
            ],
        },
    ],
});
