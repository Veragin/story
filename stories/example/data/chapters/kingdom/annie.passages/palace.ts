import { DeltaTime } from '@story/shared';
import { TPassage } from '@story/types';
import { TKingdomAnniePassageId } from '../kingdom.passages';

export const palacePassage = (): TPassage<'kingdom', 'annie', TKingdomAnniePassageId> => {
    return {
        chapterId: 'kingdom',
        characterId: 'annie',
        id: 'palace',

        type: 'screen',
        title: _('Palace'),
        image: '',

        body: [
            {
                condition: true,
                text: _('text'),
                links: [
                    {
                        text: _('Back to intro'),
                        passageId: 'kingdom-annie-intro',
                        cost: DeltaTime.fromMin(10),
                        autoPriortiy: 1,
                    },
                    {
                        text: _('Back to intro with axe'),
                        passageId: 'kingdom-annie-intro',
                        cost: {
                            time: DeltaTime.fromMin(100),
                            tools: ['axe'],
                        },
                        autoPriortiy: 5,
                    },
                ],
            },
        ],
    };
};
