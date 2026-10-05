import { IconButton, styled, Tooltip } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import CloseIcon from '@mui/icons-material/Close';

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
        <Tooltip title={_('Move up')}>
            <span>
                <IconButton
                    size="small"
                    disabled={disabled || index === 0}
                    aria-label={_('Move %s up', rowLabel)}
                    data-action="move-up"
                    onClick={() => onMove(index, index - 1)}
                >
                    <ArrowUpwardIcon fontSize="inherit" />
                </IconButton>
            </span>
        </Tooltip>
        <Tooltip title={_('Move down')}>
            <span>
                <IconButton
                    size="small"
                    disabled={disabled || index === count - 1}
                    aria-label={_('Move %s down', rowLabel)}
                    data-action="move-down"
                    onClick={() => onMove(index, index + 1)}
                >
                    <ArrowDownwardIcon fontSize="inherit" />
                </IconButton>
            </span>
        </Tooltip>
        <Tooltip title={_('Remove')}>
            <span>
                <IconButton
                    size="small"
                    disabled={disabled}
                    aria-label={_('Remove %s', rowLabel)}
                    data-action="remove-row"
                    onClick={() => onRemove(index)}
                >
                    <CloseIcon fontSize="inherit" />
                </IconButton>
            </span>
        </Tooltip>
    </SActions>
);

const SActions = styled('div')`
    display: flex;
    flex-shrink: 0;
    align-items: center;
    min-height: 40px;
`;
