import NotesIcon from '@mui/icons-material/Notes';
import { TooltipIconButton } from './TooltipIconButton';

type TProps = {
    shown: boolean;
    onToggle: () => void;
    disabled?: boolean;
    className?: string;
};

export const DescriptionToggleButton = ({
    shown,
    onToggle,
    disabled,
    className,
}: TProps) => (
    <TooltipIconButton
        title={shown ? _('Hide description') : _('Show description')}
        icon={NotesIcon}
        pressed={shown}
        disabled={disabled}
        className={className}
        data-action="toggle-description"
        onClick={onToggle}
    />
);
