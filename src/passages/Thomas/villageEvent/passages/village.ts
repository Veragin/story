import { TPassage } from 'types/TPassage';
import { s } from 'worldState';

export const villagePassage: TPassage<'thomas', 'village'> = () => ({
    id: 'village',
    eventId: 'village',
    title: 'title',
    image: 'image',

    data: {
        type: 'screen',
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
    },
});
