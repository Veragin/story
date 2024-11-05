import { DeltaTime } from 'time/Time';
import { TPassage } from 'types/TPassage';
import { TWorldState } from 'data/TWorldState';
import { TKingdomAnniePassageId } from '../kingdom.passages';

export const introPassage = (s: TWorldState): TPassage<'kingdom', 'annie', TKingdomAnniePassageId> => {
    return {
        eventId: 'kingdom',
        characterId: 'annie',
        id: 'intro',

        type: 'screen',
        title: 'Intro',
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
    };
};
