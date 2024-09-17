import { TPassage } from 'types/TPassage';
import { s } from 'worldState';

export const introPassage: TPassage<'thomas', 'village'> = () => ({
    id: 'intro',
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
                        passageId: 'forest',
                        cost: s.time ? 1 : 2,
                    },
                ],
            },
        ],
    },
});
