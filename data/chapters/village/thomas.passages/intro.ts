import { DeltaTime } from '@story/shared';
import { TPassage } from '@story/types';
import { TVillageThomasPassageId } from '../village.passages';

export const introPassage = (): TPassage<'village', 'thomas', TVillageThomasPassageId> => ({
    chapterId: 'village',
    characterId: 'thomas',
    id: 'intro',

    type: 'screen',
    title: 'Intro',
    image: 'Thomas, a young hunter in a brown tunic, standing on a misty forest path.',

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
