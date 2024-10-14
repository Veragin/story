import { DeltaTime } from 'time/Time';
import { TPassage } from 'types/TPassage';
import { s } from 'worldState';
import { TVillageThomasPassageId } from '../village.passages';

export const forestPassage = (): TPassage<'village', 'thomas', TVillageThomasPassageId> => ({
    eventId: 'village',
    characterId: 'thomas',
    id: 'forest',

    type: 'screen',
    title: 'Forest',
    image: 'hunter',

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
