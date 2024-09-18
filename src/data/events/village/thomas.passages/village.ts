import { TPassage } from 'types/TPassage';
import { s } from 'worldState';

export const villagePassage: TPassage<'thomas', 'village'> = () => ({
    id: 'forest',
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
                    passageId: 'intro',
                    cost: s.time ? 1 : 2,
                },
            ],
        },
    ],
});
