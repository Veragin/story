import { DeltaTime } from 'code/time/Time';
import { TPassage } from 'types/TPassage';

export const introPassage = (): TPassage<'kingdom', 'annie'> => ({
    id: 'intro',
    eventId: 'kingdom',
    characterId: 'annie',
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
                    passageId: 'intro',
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
