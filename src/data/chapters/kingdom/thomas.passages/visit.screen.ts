import { DeltaTime } from '@story/shared';
import { TPassage } from '@story/types';
import { TKingdomThomasPassageId } from '../kingdom.passages';
import { TWorldState } from 'data/TWorldState';
import type { Engine } from '@story/core';

export const visitPassage = (s: TWorldState, e: Engine): TPassage<'kingdom', 'thomas', TKingdomThomasPassageId> => {
    void s;
    void e;

    return {
        chapterId: 'kingdom',
        characterId: 'thomas',
        id: 'visit',

        type: 'screen',
        title: _('visit'),
        image: '',

        body: [
            {
                text: _(''),
                links: [
                    {
                        text: _(''),
                        passageId: 'kingdom-thomas-visit',
                        cost: DeltaTime.fromMin(10),
                    },
                ],
            },
        ],
    };
};
