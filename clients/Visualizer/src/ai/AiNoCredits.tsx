import { styled } from '@mui/material';
import { spacingCss } from '@story/ui';
import { ErrorAlert } from '../components/feedback/ErrorAlert';

export const AiNoCredits = () => (
    <SErrorAlert
        error={_(
            'The story has no AI credits left. The agent cannot take new messages until credits are added.'
        )}
    />
);

const SErrorAlert = styled(ErrorAlert)`
    margin: ${spacingCss(1)};
`;
