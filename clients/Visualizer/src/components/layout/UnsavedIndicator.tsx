import { Chip, Tooltip } from '@mui/material';
import FiberManualRecord from '@mui/icons-material/FiberManualRecord';

type TProps = {
    variant?: 'chip' | 'dot';
};

export const UnsavedIndicator = ({ variant = 'chip' }: TProps) =>
    variant === 'chip' ? (
        <Chip size="small" color="warning" label={_('Unsaved')} />
    ) : (
        <Tooltip title={_('Unsaved changes')}>
            <FiberManualRecord
                color="warning"
                aria-label={_('Unsaved changes')}
                sx={{ fontSize: 10, ml: 1 }}
            />
        </Tooltip>
    );
