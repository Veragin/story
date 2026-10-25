import CategoryIcon from '@mui/icons-material/Category';
import ForestIcon from '@mui/icons-material/Forest';
import HandymanIcon from '@mui/icons-material/Handyman';
import PaidIcon from '@mui/icons-material/Paid';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import ShieldIcon from '@mui/icons-material/Shield';
import type { SvgIconComponent } from '@mui/icons-material';

const TYPE_ICONS: Record<string, SvgIconComponent> = {
    food: RestaurantIcon,
    tool: HandymanIcon,
    weapon: ShieldIcon,
    value: PaidIcon,
    resource: ForestIcon,
};

type Props = {
    type: string | undefined;
};

export const ItemTypeIcon = ({ type }: Props) => {
    const Icon = (type && TYPE_ICONS[type]) || CategoryIcon;
    return <Icon fontSize="inherit" />;
};
