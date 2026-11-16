import type { TIllustratedPassageDto, TPassageDto } from '@story/protocol';

export const isIllustrated = (d: TPassageDto): d is TIllustratedPassageDto =>
    d.type === 'screen' || d.type === 'linear';
