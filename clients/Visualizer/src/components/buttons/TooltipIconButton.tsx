import {
    CircularProgress,
    IconButton,
    Tooltip,
    type IconButtonProps,
} from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';

export type TIconButtonTone = 'default' | 'inherit' | 'error';

type TProps = Omit<
    IconButtonProps,
    'children' | 'color' | 'size' | 'title' | 'aria-label' | 'aria-pressed'
> & {
    title: string;
    icon: SvgIconComponent;
    tone?: TIconButtonTone;
    pressed?: boolean;
    busy?: boolean;
};

export const TooltipIconButton = ({
    title,
    icon: Icon,
    tone = 'default',
    pressed,
    busy,
    disabled,
    ...rest
}: TProps) => (
    <Tooltip title={title} describeChild>
        <span>
            <IconButton
                {...rest}
                size="small"
                color={pressed ? 'primary' : tone}
                aria-label={title}
                aria-pressed={pressed}
                disabled={disabled || busy}
            >
                {busy ? (
                    <CircularProgress size={16} color="inherit" />
                ) : (
                    <Icon fontSize="small" />
                )}
            </IconButton>
        </span>
    </Tooltip>
);
