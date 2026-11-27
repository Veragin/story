import { styled } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import CloseIcon from '@mui/icons-material/Close';
import { TooltipIconButton } from './TooltipIconButton';

type TProps = {
    index: number;
    count: number;
    onMove: (from: number, to: number) => void;
    onRemove: (index: number) => void;
    disabled?: boolean;
    rowLabel: string;
};

export const RowActions = ({
    index,
    count,
    onMove,
    onRemove,
    disabled,
    rowLabel,
}: TProps) => (
    <SActions>
        <TooltipIconButton
            title={_('Move %s up', rowLabel)}
            icon={ArrowUpwardIcon}
            disabled={disabled || index === 0}
            data-action="move-up"
            onClick={() => onMove(index, index - 1)}
        />
        <TooltipIconButton
            title={_('Move %s down', rowLabel)}
            icon={ArrowDownwardIcon}
            disabled={disabled || index === count - 1}
            data-action="move-down"
            onClick={() => onMove(index, index + 1)}
        />
        <TooltipIconButton
            title={_('Remove %s', rowLabel)}
            icon={CloseIcon}
            disabled={disabled}
            data-action="remove-row"
            onClick={() => onRemove(index)}
        />
    </SActions>
);

const SActions = styled('div')`
    display: flex;
    flex-shrink: 0;
    align-items: center;
    min-height: 40px;
`;
