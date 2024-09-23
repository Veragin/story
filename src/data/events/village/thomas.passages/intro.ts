import { DeltaTime } from 'time/Time';
import { TPassage } from 'types/TPassage';

export const introPassage = (): TPassage<'village', 'thomas'> => ({
    eventId: 'village',
    characterId: 'thomas',
    id: 'intro',

    type: 'screen',
    title: 'Intro',
    image: 'image',

    body: [
        {
            condition: true,
            text: 'text',
            links: [
                {
                    text: 'Lets go to the forest',
                    passageId: 'village-thomas-forest',
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
