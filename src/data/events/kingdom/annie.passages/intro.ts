import { DeltaTime } from 'time/Time';
import { TPassage } from 'types/TPassage';

export const introPassage = (): TPassage<'kingdom', 'annie'> => ({
    eventId: 'kingdom',
    characterId: 'annie',
    id: 'intro',

    type: 'screen',
    title: 'title',
    image: 'image',

    body: [
        {
            condition: true,
            text: 'text',
            links: [
                {
                    text: 'Lets go to the forest',
                    passageId: 'kingdom-annie-intro',
                    cost: {
                        time: DeltaTime.fromMin(10),
                        items: [{ id: 'axe', count: 1 }],
                    },
                    autoPriortiy: 1,
                },
            ],
        },
    ],
});
