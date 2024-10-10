import { DeltaTime } from 'time/Time';
import { TPassage } from 'types/TPassage';
import { TKingdomPassageId } from '../kingdom.event';

export const palacePassage = (): TPassage<'kingdom', 'annie', TKingdomPassageId> => {
    return {
        eventId: 'kingdom',
        characterId: 'annie',
        id: 'palace',

        type: 'screen',
        title: 'Palace',
        image: 'image',

        body: [
            {
                condition: true,
                text: 'text',
                links: [
                    {
                        text: 'Back to intro',
                        passageId: 'kingdom-annie-intro',
                        cost: DeltaTime.fromMin(10),
                        autoPriortiy: 1,
                    },
                    {
                        text: 'Back to intro with axe',
                        passageId: 'kingdom-annie-intro',
                        cost: {
                            time: DeltaTime.fromMin(100),
                            tools: ['axe'],
                        },
                        autoPriortiy: 5,
                    },
                ],
            },
        ],
    };
};
