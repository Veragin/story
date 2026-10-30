import { TPassage } from '@story/types';
import { TStartHeroPassageId } from '../start.passages';

export const introPassage = (): TPassage<'start', 'hero', TStartHeroPassageId> => ({
    chapterId: 'start',
    characterId: 'hero',
    id: 'intro',

    type: 'screen',
    title: _('Intro'),
    image: '',

    body: [
        {
            text: _('Your story begins here.'),
        },
    ],
});
