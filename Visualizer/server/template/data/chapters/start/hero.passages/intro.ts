import { TPassage } from '@story/types';
import { TStartHeroPassageId } from '../start.passages';

export const introPassage = (): TPassage<'start', 'hero', TStartHeroPassageId> => ({
    chapterId: 'start',
    characterId: 'hero',
    id: 'intro',

    type: 'screen',
    title: 'Intro',
    image: '',

    body: [
        {
            text: 'Your story begins here.',
        },
    ],
});
