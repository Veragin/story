import { TPassage } from 'types/TPassage';
import { s } from 'worldState';

const passage: TPassage = () => ({
    id: 'start',
    eventId: 1,
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
                        passageId: 1,
                        cost: s.time ? 1 : 2,
                    },
                ],
            },
        ],
    },
});

export default passage;
