import { DeltaTime } from 'Time/Time';
import { TPassage } from 'types/TPassage';

export const introPassage: TPassage<'thomas', 'village'> = () => ({
    id: 'intro',
    eventId: 'village',
    type: 'screen',
    title: 'title',
    image: 'image',

    body: [
        {
            condition: true,
            text: 'text',
            links: [
                {
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
