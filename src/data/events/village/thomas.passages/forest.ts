import { DeltaTime } from 'time/Time';
import { TPassage } from 'types/TPassage';
import { s } from 'worldState';

export const forestPassage = (): TPassage<'village', 'thomas'> => ({
    eventId: 'village',
    characterId: 'thomas',
    id: 'forest',

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
                    passageId: 'village-thomas-intro',
                    cost: s.time.s < 10 ? DeltaTime.fromMin(1) : DeltaTime.fromMin(2),
                    autoPriortiy: 2,
                },
            ],
        },
    ],
});
