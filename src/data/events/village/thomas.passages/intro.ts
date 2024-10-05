import { DeltaTime } from 'time/Time';
import { TPassage } from 'types/TPassage';

const passage = (): TPassage<'village', 'thomas'> => ({
    eventId: 'village',
    characterId: 'thomas',
    id: 'intro',

    type: 'screen',
    title: 'Intro',
    image: 'hunter',

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
                    },
                    autoPriortiy: 1,
                },
            ],
        },
    ],
});

export default passage;
