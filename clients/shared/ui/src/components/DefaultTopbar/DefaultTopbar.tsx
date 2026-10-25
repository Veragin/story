import FavoriteIcon from '@mui/icons-material/Favorite';
import { TopbarStat } from '../TopbarStat/TopbarStat';

type TCharacterStats = { health: number };

type Props = {
    s: {
        mainCharacterId: string;
        characters: Readonly<Record<string, TCharacterStats>>;
    };
};

export const DefaultTopbar = ({ s }: Props) => (
    <TopbarStat
        icon={FavoriteIcon}
        label={_('Health')}
        value={`${Math.floor(s.characters[s.mainCharacterId].health)}%`}
    />
);
