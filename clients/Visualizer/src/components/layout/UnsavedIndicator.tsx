import { Chip, styled, Tooltip } from '@mui/material';
import { spacingCss } from '@story/ui';
import FiberManualRecord from '@mui/icons-material/FiberManualRecord';

type TProps = {
    variant?: 'chip' | 'dot';
};

export const UnsavedIndicator = ({ variant = 'chip' }: TProps) =>
    variant === 'chip' ? (
        <Chip size="small" color="warning" label={_('Unsaved')} />
    ) : (
        <Tooltip title={_('Unsaved changes')}>
            <SDot color="warning" aria-label={_('Unsaved changes')} />
        </Tooltip>
    );

const SDot = styled(FiberManualRecord)`
    font-size: 10px;
    margin-left: ${spacingCss(1)};
`;
