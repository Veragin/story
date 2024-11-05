import { DeltaTime } from 'time/Time';
import { TPassage } from 'types/TPassage';
import { TKingdomThomasPassageId } from '../kingdom.passages';
import { TWorldState } from 'data/TWorldState';
import { Engine } from 'code/Engine/ts/Engine';

export const visitPassage = (s: TWorldState, e: Engine): TPassage<'kingdom', 'thomas', TKingdomThomasPassageId> => {
    void s;
    void e;

    return {
        eventId: 'kingdom',
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
