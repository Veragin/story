import { DeltaTime } from '@story/shared';
import { TPassage } from '@story/types';
import type { TWorldState } from '../../../TWorldState';
import { TKingdomAnniePassageId } from '../kingdom.passages';

export const introPassage = (s: TWorldState): TPassage<'kingdom', 'annie', TKingdomAnniePassageId> => {
    return {
        chapterId: 'kingdom',
        characterId: 'annie',
        id: 'intro',

        type: 'screen',
        title: 'Intro',
        image: 'image',

        body: [
            {
                condition: s.characters.annie.health > 0,
                text: 'text',
                links: [
                    {
                        text: 'Lets go to the forest',
                        passageId: 'kingdom-annie-palace',
                        cost: {
                            time: DeltaTime.fromMin(10),
                            items: [{ id: 'berries', amount: 1 }],
                        },
                        autoPriortiy: 1,
                    },
                ],
            },
        ],
    };
};
