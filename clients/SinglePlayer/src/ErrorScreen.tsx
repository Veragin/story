import { Alert, Button, styled } from '@mui/material';
import { Column, spacingCss, WholeContainer } from '@story/ui';
import { landingUrl } from './links';
import { IS_STANDALONE } from './standalone';

type Props = {
    message: string;
};

export const ErrorScreen = ({ message }: Props) => (
    <WholeContainer>
        <SContainer>
            <Alert severity="error">{message}</Alert>
            {!IS_STANDALONE && (
                <Button variant="contained" href={landingUrl()}>
                    {_('Back to the stories')}
                </Button>
            )}
        </SContainer>
    </WholeContainer>
);

const SContainer = styled(Column)`
    justify-content: center;
    align-items: center;
    gap: ${spacingCss(3)};
    flex: 1;
    padding: ${spacingCss(2)};
`;
