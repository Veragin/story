import { DeltaTime } from '@story/shared';
import { TPassage } from '@story/types';
import type { TWorldState } from '../../../TWorldState';
import { TVillageThomasPassageId } from '../village.passages';

export const forestPassage = (s: TWorldState): TPassage<'village', 'thomas', TVillageThomasPassageId> => ({
    chapterId: 'village',
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
