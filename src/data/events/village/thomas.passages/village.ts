import { DeltaTime } from 'code/time/Time';
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
                    text: 'Lets hunt',
                    passageId: 'intro',
                    cost: s.time.s < 10 ? DeltaTime.fromMin(1) : DeltaTime.fromMin(2),
                },
            ],
        },
    ],
});
