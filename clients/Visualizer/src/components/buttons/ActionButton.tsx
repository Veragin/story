import { Button, type ButtonProps, type IconButtonProps } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';
import { TooltipIconButton, type TIconButtonTone } from './TooltipIconButton';

export type TActionButtonProps = {
    'label': string;
    'onClick'?: () => void;
    'disabled'?: boolean;
    'iconOnly'?: boolean;
    'tone'?: TIconButtonTone;
    'variant'?: ButtonProps['variant'];
    'fullWidth'?: boolean;
    'edge'?: IconButtonProps['edge'];
    'className'?: string;
    'sx'?: ButtonProps['sx'];
    'data-action'?: string;
};

type TProps = TActionButtonProps & { icon: SvgIconComponent };

const TEXT_COLOR = {
    default: 'primary',
    inherit: 'inherit',
    error: 'error',
} satisfies Record<TIconButtonTone, ButtonProps['color']>;

export const ActionButton = ({
    label,
    icon: Icon,
    iconOnly,
    tone = 'default',
    variant,
    fullWidth,
    edge,
    ...rest
}: TProps) =>
    iconOnly ? (
        <TooltipIconButton
            {...rest}
            title={label}
            icon={Icon}
            tone={tone}
            edge={edge}
        />
    ) : (
        <Button
            {...rest}
            size="small"
            color={TEXT_COLOR[tone]}
            variant={variant}
            fullWidth={fullWidth}
            startIcon={<Icon fontSize="small" />}
        >
            {label}
        </Button>
    );
