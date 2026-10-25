import { Favorite as FavoriteIcon } from '@mui/icons-material';
import { TopbarStat } from '@story/ui';
import type { TTopbarProps } from '@story/types';

/** Health of the main character, as a heart icon and a percentage. */
export const Topbar = ({ s }: TTopbarProps) => (
    <TopbarStat
        icon={FavoriteIcon}
        label={_('Health')}
        value={`${Math.floor(s.characters[s.mainCharacterId].health)}%`}
    />
);
