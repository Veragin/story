import { CircularProgress, styled } from '@mui/material';
import { spacingCss } from '@story/ui';

const SPINNER_SIZE = 24;

type TProps = {
    label?: string;
};

export const LoadingState = ({ label = _('Loading…') }: TProps) => (
    <SCentered role="status" aria-label={label}>
        <CircularProgress size={SPINNER_SIZE} />
    </SCentered>
);

const SCentered = styled('div')`
    display: flex;
    justify-content: center;
    align-items: center;
    padding: ${spacingCss(2)};
`;
