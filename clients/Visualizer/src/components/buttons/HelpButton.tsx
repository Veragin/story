import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { TooltipIconButton } from './TooltipIconButton';

type TProps = {
    onClick: () => void;
    title?: string;
};

export const HelpButton = ({ onClick, title = _('Help') }: TProps) => (
    <TooltipIconButton
        title={title}
        icon={HelpOutlineIcon}
        tone="inherit"
        onClick={onClick}
    />
);
