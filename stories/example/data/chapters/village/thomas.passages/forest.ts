import { DeltaTime } from '@story/shared';
import { TPassage } from '@story/types';
import type { TWorldState } from '../../../TWorldState';
import { TVillageThomasPassageId } from '../village.passages';

export const forestPassage = (s: TWorldState): TPassage<'village', 'thomas', TVillageThomasPassageId> => ({
    chapterId: 'village',
    characterId: 'thomas',
    id: 'forest',

    execute: () => {
        if (s.characters.annie.health < 50) {
            s.characters.annie.health += 50;
        }
    },

    type: 'screen',
    title: 'Forest',
    image: 'Thomas, a young hunter in a brown tunic, standing on a misty forest path.',

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
