import { DeltaTime } from 'code/time/Time';
import { TPassage } from 'types/TPassage';

export const introPassage: TPassage<'village', 'thomas'> = () => ({
    id: 'intro',
    eventId: 'village',
    characterId: 'thomas',
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
                    passageId: 'forest',
                    cost: [
                        {
                            time: DeltaTime.fromMin(10),
                            items: [{ id: 'axe', count: 1 }],
                        },
                    ],
                },
            ],
        },
    ],
});
